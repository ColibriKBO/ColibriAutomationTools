"""
Filename:   astrometry_correction.py
Author(s):  Peter Quigley
Contact:    pquigle@uwo.ca
Created:    Tue Nov 22 14:39 2022
Updated:    Mon May  1 14:35 2023
    
Description:
Analyzes a test image to determine the astrometric correction required to align
the telescope with the intended sky coordinates. This is done by comparing the
coordinates of the stars in the image with the coordinates of the same stars
from a reference catalog. The astrometric correction is then applied to the
telescope, fed via RunColibri.js' child process.

Usage:

"""

# Module Imports
import os, sys
import argparse
import sep
import subprocess
import binascii
import numpy as np
import numba as nb
import matplotlib.pyplot as plt
from astropy.io import fits
from astropy.io.fits import Header
from astropy import wcs
from pathlib import Path

# Custom Imports


#-------------------------------global vars-----------------------------------#

# Path variables
BASE_PATH = Path('D:/')
DATA_PATH = BASE_PATH / 'ColibriData'
IMGE_PATH = BASE_PATH / 'ColibriImages'
ARCHIVE_PATH = BASE_PATH / 'ColibriArchive'

# Image variables (assumes square image)
IMG_WIDTH = 2048
BIT_DEPTH = 12
IMG_SIZE = IMG_WIDTH**2

# Verbose print statement
verboseprint = lambda *a, **k: None


#--------------------------------functions------------------------------------#

###########################
## File Reading
###########################

def readxbytes(fid, start_byte, num_bytes, dtype):
    """
    Read a specified number of bytes from a file and return the data.

    Args:
        fid (file): The file to be read from.
        start_byte (int): The byte to start reading from.
        num_bytes (int): The number of bytes to read.
        dtype (str): The data type of the data to be read.

    Returns:
        data (np.ndarray): A numpy array containing the data read from the file.

    """

    # Seek to the specified byte
    fid.seek(start_byte)

    # Read the data
    data = np.fromfile(fid, dtype=dtype, count=num_bytes)

    return data


# Function to read 12-bit data with Numba to speed things up
@nb.njit(nb.uint16[::1](nb.uint8[::1]),fastmath=True,parallel=True)
def conv_12to16(data_chunk):
    """
    Function to read 12-bit data with Numba to speed things up.

    Credit to Mike Mazur for this function.
    
    Args:
        data_chunk (arr): A contigous 1D array of uint8 data
                              eg.data_chunk = np.frombuffer(data_chunk, dtype=np.uint8)
   
    Returns:
        out (arr): Output data in 16-bit format
   """
   
    #ensure that the data_chunk has the right length
    assert np.mod(data_chunk.shape[0],3)==0

    out=np.empty(data_chunk.shape[0]//3*2,dtype=np.uint16)

    for i in nb.prange(data_chunk.shape[0]//3):
        fst_uint8=np.uint16(data_chunk[i*3])
        mid_uint8=np.uint16(data_chunk[i*3+1])
        lst_uint8=np.uint16(data_chunk[i*3+2])

        out[i*2] =   (fst_uint8 << 4) + (mid_uint8 >> 4)
        out[i*2+1] = ((mid_uint8 % 16) << 8) + lst_uint8

    return out


def readRCD(filename):
    """
    Read a .rcd image file and return the data and relevant header information.

    Args:
        filename (str): The name of the .rcd file to be read.
    
    Returns:
        hdict (dict): A dictionary containing the header information.
            exptime (float): The exposure time of the image.
            timestamp (str): The timestamp of the image.
            lat (float): The latitude of the telescope.
            lon (float): The longitude of the telescope.
        data (np.ndarray): A numpy array containing the image data.

    Notes:
        This function reads high-gain lines, assumes 2x2 binning, and a
        2048x2048x12-bit image. These values are hard-coded into the function.

    """

    # Open the file
    with open(filename, 'rb') as rcd:

        # Read the header
        exptime = readxbytes(rcd, 85, 4, np.float32)
        timestamp = readxbytes(rcd, 152, 29, str)
        lat = readxbytes(rcd, 182, 4, np.float32)
        lon = readxbytes(rcd, 186, 4, np.float32)

        # Read the data, convert to 16-bit, extract high-gain lines, reshape
        # size = (2048x2048 image) * (2 high/low gain modes) * 12-bit depth
        data = readxbytes(rcd, 384, IMG_SIZE*2*(BIT_DEPTH/8), np.uint8)
        data = conv_12to16(data)
        data = (data.reshape(2*IMG_WIDTH, IMG_WIDTH))[1::2]

        return {'EXPTIME':exptime, 'DATE-OBS':timestamp,
                'SITELAT':lat, 'SITELONG':lon}, data


def writeToFITS(filename, header, data):
    """
    Write data to a FITS file.
    
    Args:
        filename (str): The name of the FITS file to be written.
        data (np.ndarray): A numpy array containing the image data.
        header (dict): A dictionary containing the header information.

    Returns:
        None

    """

    # Update the site latitude and longitude to be in degrees
    header['SITELAT'], header['SITELONG'] = computelatlong(header['SITELAT'], header['SITELONG'])

    # Create the HDU object, overwrite if the file already exists
    hdu = fits.PrimaryHDU(data)
    hdu.header = Header(header)

    # Write the data to a FITS file
    hdu.writeto(filename, overwrite=True)


###########################
## Image Processing
###########################

def computelatlong(lat,lon): 
    """
    Compute the latitude and longitude of the telescope from the raw data.
    Output is in degrees.

    Args:
        lat (str): The raw latitude data.
        lon (str): The raw longitude data.

    Returns:
        latitude (float): The latitude of the telescope.
        longitude (float): The longitude of the telescope.
    """

    degdivisor = 600000.0
    degmask = int(0x7fffffff)
    dirmask = int(0x80000000)

    latraw = int(binascii.hexlify(lat),16)
    lonraw = int(binascii.hexlify(lon),16)

    # Check the direction of the latitude
    if (latraw & dirmask) != 0:
        latitude = (latraw & degmask) / degdivisor
    else:
        latitude = -1*(latraw & degmask) / degdivisor

    # Check the direction of the longitude
    if (lonraw & dirmask) != 0:
        longitude = (lonraw & degmask) / degdivisor
    else:
        longitude = -1*(lonraw & degmask) / degdivisor

    return latitude, longitude


def extractStars(image_data, detect_threshold):
    """
    Locates the stars in an image using the sep module and completes
    preliminary photometry on the image. Does not subtract dark!

    Args:
        img_data (arr): 2D array of image flux data
        detect_thresh (float): Detection threshold for star finding
        
    Returns:
        star_chars (arr): [x, y] of all stars in pixels
    """

    # Find the stars in the image
    bkg = sep.Background(image_data)
    star_data = sep.extract(image_data, detect_threshold, err=bkg.globalrms)
    #star_chars = np.array([star_data['x'], star_data['y'], star_data['flux']]).T
    star_chars = np.array([star_data['x'], star_data['y']]).T

    return star_chars


###########################
## WCS Solving
###########################

def getLocalSolution(image_file, save_file, order):
    """
    Astrometry.net must be installed locally to use this function. It installs under WSL.
    To use the local solution, you'll need to modify call to the function somewhat.
    This function will write the new fits file w/ plate solution to a file with the name save_file in the
    tmp directory on the d: drive.
    The function will return wcs_header. Alternatively, you could comment out those lines and read it from
    the pipeline.
    """

    try:
        # -D to specify write directory, -o to specify output base name, -N new-fits-filename
        verboseprint(f"Reading from {image_file} for astrometry solution.")
        # print(save_file.split(".")[0])
        verboseprint(f"Writing WCS header to {save_file.split('.fits')[0] + '.wcs'}")

        # TODO: check if changing directories is needed
        cwd = os.getcwd()
        os.chdir(str(BASE_PATH))

        # Run the astrometry.net command from wsl command line
        p = subprocess.run('wsl time solve-field --no-plots -D /mnt/d/tmp -O -o ' + save_file.split(".fits")[0] + ' -N ' + save_file + ' -t ' + str(order) + ' --scale-units arcsecperpix --scale-low 2.2 --scale-high 2.6 ' + image_file)
        
        os.chdir(cwd)

    except:
        pass

    # Read the WCS header from the new output file
    wcs_header = Header.fromfile('d:\\tmp\\' + save_file.split(".fits")[0] + '.wcs')
    return wcs_header


def getSolution(image_file, save_file, order):
    '''send request to solve image from astrometry.net
    input: path to the image file to submit, filepath to save the WCS solution header to, order of soln
    returns: WCS solution header'''
    from astroquery.astrometry_net import AstrometryNet
    #astrometry.net API
    ast = AstrometryNet()
    
    #key for astrometry.net account
    ast.api_key = 'vbeenheneoixdbpb'    #key for Rachel Brown's account (040822)
    wcs_header = ast.solve_from_image(image_file, crpix_center = True, tweak_order = order, force_image_upload=True)

    #save solution to file
    if not save_file.exists():
            wcs_header.tofile(save_file)
            
    return wcs_header


def getWCSTransform(fits_filepath, file_str='ast_corr', soln_order=4):
    """
    Finds median image that best fits for the time of the detection and uses it to get Astrometry solution.
    Required to have a list of median-combined images (median_combos)


    Args:
        fits_filepath (str): Path to the fits file
        file_str (str): Basename of saved WCS solution file
        soln_order (int): Order of the WCS solution

    Returns:
        wcs (astropy.wcs.wcs.WCS): WCS solution for the image        

    """

    # TODO: Fix this function

    # Try to create a WCS solution for the image
    try:
        #try if local Astrometry can solve it
        wcs_header = getLocalSolution(fits_filepath, file_str, soln_order)
    except:
        wcs_header = getSolution(fits_filepath, file_str, soln_order)

    #calculate coordinate transformation
    transform = wcs.WCS(wcs_header)


###########################
## RADEC <-> XY Mapping
###########################

def getRADEC_Single(transform, x, y):
    """
    Converts a single pixel coordinate to RA/Dec using the WCS solution

    Args:
        transform (astropy.wcs.wcs.WCS): WCS solution for the image
        x (float): x coordinate of the pixel
        y (float): y coordinate of the pixel

    Returns:
        ra (float): Right Ascension of the pixel in decimal degrees
        dec (float): Declination of the pixel in decimal degrees
    """

    # Convert the pixel coordinates to RA/Dec
    ra,dec = transform.pixel_to_world(x, y)

    verboseprint(f"(x,y) = ({x},{y}) -> (RA,Dec) = ({ra},{dec})")
    return ra,dec


def getXY_Single(transform, ra, dec):
    """
    Converts a single RA/Dec coordinate to pixel coordinates using the WCS solution

    Args:
        transform (astropy.wcs.wcs.WCS): WCS solution for the image
        ra (float): Right Ascension of the pixel in decimal degrees
        dec (float): Declination of the pixel in decimal degrees

    Returns:
        x (float): x coordinate of the pixel
        y (float): y coordinate of the pixel
    """

    # Convert the RA/Dec coordinates to pixel coordinates
    x,y = transform.world_to_pixel(ra, dec)

    verboseprint(f"(RA,Dec) = ({ra},{dec}) -> (x,y) = ({x},{y})")
    return x,y


#----------------------------------main---------------------------------------#

if __name__ == '__main__':

###########################
## Argparse Setup
###########################

    # Generate argument parser
    parser = argparse.ArgumentParser(description='Astrometric correction for Colibri.')

    # Available argument functionality
    parser.add_argument('image', type=str, help='The image to be analyzed.')
    parser.add_argument('coords', type=float, nargs=2, 
                        help='The (RA,DEC) coordinates of the target in decimal degrees.')
    parser.add_argument('-t', '--test', action='store_true',
                        help='Run in test mode.')
    

    # Process argparse list as useful variables
    args = parser.parse_args()
    ref_image = Path(args.image)
    ra,dec = args.coords
    test = args.test

    # Check that the reference image exists
    # If not, no correction will be applied
    if not ref_image.exists():
        print("0.0 0.0")
        raise FileNotFoundError(f"Reference image for astrometric correction '{ref_image}' not found.")

    # If in test mode, verboseprint is now print
    if test:
        verboseprint = print
    

###########################
## Astrometry
###########################

    # If the reference image is an rcd file, convert it to a fits file
    if ref_image.suffix == '.rcd':
        # Extract information from the reference image
        verboseprint(f"Reading reference image '{ref_image}'...")
        ref_hdict, ref_data = readRCD(ref_image)

        # Save the header and data as a fits file
        FITS_path = BASE_PATH / 'tmp' / ('astr_corr.fits')
        writeToFITS(FITS_path, ref_hdict, ref_data)
    
    # Otherwise, the reference image is already a fits file
    elif ref_image.suffix == '.fits':
        FITS_path = ref_image

    # Otherwise, the reference image is not a valid file type
    else:
        print("0.0 0.0")
        raise TypeError(f"Reference image for astrometric correction '{ref_image}' is not a valid file type.")

    # Get the WCS solution for the reference image
    verboseprint("Getting WCS solution for reference image...")
    ref_wcs = getWCSTransform(FITS_path)

    # Convert the central pixel of the reference image to RA/Dec
    verboseprint("Converting central pixel of reference image to RA/Dec...")
    ref_ra,ref_dec = getRADEC_Single(ref_wcs, IMG_WIDTH/2, IMG_WIDTH/2)

    # Calculate the offset between the reference image and the target
    verboseprint("Calculating offset between reference image and target...")
    ra_offset = ra - ref_ra
    dec_offset = dec - ref_dec
    
    # Print the offset
    print(f"{ra_offset} {dec_offset}")

    # If in test mode, plot the reference image with the target marked
    if test:
        fig, ax = plt.subplots()

        # Plot the reference image and mark the central pixel
        ax.imshow(ref_data, cmap='gray', origin='upper')
        ax.plot(IMG_WIDTH/2, IMG_WIDTH/2, 'r+', label='Center')

        # Calculate pixel coordinates of the target and mark it
        target_x,target_y = getXY_Single(ref_wcs, ra, dec)
        ax.plot(target_x, target_y, 'b+', label='Target')

        # Add text with the offsets
        ax.text(0.05, 0.95, f"RA Offset: {ra_offset}\nDec Offset: {dec_offset}", 
                transform=ax.transAxes, ha='left', va='top')
        
        # Add legend and show the plot
        ax.legend()
        plt.show()
