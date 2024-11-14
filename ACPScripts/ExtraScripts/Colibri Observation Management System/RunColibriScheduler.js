import { getRequests, transformAltAzToRadDec } from "request.js";

import {selectBestObservation} from "selectionFunctions.js";

import {updateLog, freeDiskSpace, getDate} from "utilityFunctions.js";





// Handles script actions such as aborting, restarting, and shutdown 
// 'action' parameter determines what action to take (abort, abortAndRestart, andRestart).
// TODO: Test this function by replacing existing calls to abort, abortAndRestart, and andRestart with this function.
function handleScript(action) {
    // Check if the action is to abort or abort and restart the script.
    if (action == "abort" || action == "abortAndRestart") {
        updateLog("Aborting script!", "ERROR"); // Log an error indicating that the script is being aborted.
        
        // If the action is to abort and restart, log that the script will be restarted.
        if (action == "abortAndRestart") {
            updateLog("Restarting script!", "INFO");
        } 
    }
    // If the action is "andRestart", log that the system will shut down and restart.
    else if (action == "andRestart") {
        updateLog("Shutting down and restarting!", "INFO");
    }

    // Call the shutdown function to stop the telescope and other equipment.
    shutDown();

    // Wait for the dome shutter to close and the telescope to park.
    while(Dome.ShutterStatus != 1 || Telescope.AtPark != true) {
        Util.WaitForMilliseconds(5000); // Wait 5 seconds before checking the shutter and telescope status again.
        Console.PrintLine("Waiting 5 seconds for shutter to close and telescope to park...");
    }

    // If the action is to abort the script or abort and restart:
    if (action == "abort" || action == "abortAndRestart") {
        // If a script is currently active, abort it.
        if (Util.ScriptActive) {
            Console.PrintLine("Aborting...");
            Util.AbortScript(); // Call the method to abort the script.
        }

        // Wait until the script is fully aborted.
        while (Util.ScriptActive) {
            Console.PrintLine("Waiting for script to finish...");
            Util.WaitForMilliseconds(5000); // Wait 5 seconds before checking again.
        }
    }

    // If the action is to abort and restart or just restart, call the main function to restart the process.
    if (action == "abortAndRestart" || action == "andRestart") {
        main(); // Call the main function to restart the script.
    }
}

// Collects reference image data (bias or dark frames) using the specified filters
// Does the dirty work of collecting reference image data given a filter.
// Combines functionality of biasCollection and darkCollection functions.
function refCollection(filter, exposure, filePath) {
    // Attempt to link the camera
    try {
        // Check if the camera is not linked
        if (!ccdCamera.LinkEnabled) {
            updateLog("Camera is not linked. Attempting to link...", "INFO");
            // Enable the camera link
            ccdCamera.LinkEnabled = true;

            // Check if the camera was successfully linked.
            if (ccdCamera.LinkEnabled) {
                updateLog("Camera linked successfully.", "INFO");
            } else {
                // Log an error if the camera failed to link.
                updateLog("Failed to link the camera." , "ERROR");
                return; // Exit the function if the camera could not be linked.
            }
        } else {
            // Log if the camera was already linked.
            updateLog("Camera already linked.", "INFO");
        }
    } catch (e) {
        // Log any errors that occurred during the linking process.
        updateLog("An error occurred: " + e.message, "ERROR");
    }

    // Loop to capture 10 images
    for (var i = 0; i < 10; i++) {
        // Try to start the exposure for each image
        try {
            updateLog("Starting exposure...", "INFO");
            
            // Set binning values for the camera to 2x2
            ccdCamera.BinX = 2;
            ccdCamera.BinY = 2;

            // Start the exposure with the specified filter and exposure time
            ccdCamera.Expose(exposure, filter); // Exposure time is given in seconds.
            
            // Log that the exposure started successfully.
            updateLog("Exposure started successfully");
        } catch (e) {
            // Log any errors encountered while starting the exposure.
            updateLog("Error starting exposure: " + e.message);
        }

        // Initialize variables for waiting for the image to be ready
        var maxWaitTime = exposure * 1000; // Maximum wait time (the exposure time), in milliseconds
        var waitInterval = 500; // Interval to check if the image is ready (500ms)
        var elapsedTime = 0; // Track the elapsed time.

        // Wait for the image to be ready or until the max wait time is reached.
        try {
            // Continuously check if the image is ready within the allotted wait time.
            while (!ccdCamera.ImageReady && elapsedTime < maxWaitTime) {
                Util.WaitForMilliseconds(waitInterval); // Pause for the specified interval.
                elapsedTime += waitInterval; // Increase the elapsed time.
            }

            // If the image is ready, save it to the specified file path.
            if (ccdCamera.ImageReady) {
                // Generate a unique file name for the image using the current timestamp and exposure time.
                var newFilePath = filePath + "\\image_" + new Date().getTime() + "_" + exposure + "s.fits";
                updateLog("Saving image to: " + newFilePath, "INFO");
                
                // Save the image to the generated file path.
                ccdCamera.SaveImage(newFilePath);
                
                // Log that the image was saved successfully.
                updateLog("Image saved successfully to: " + newFilePath);
            } else {
                // Log an error if the image was not ready within the max wait time.
                updateLog("Image not ready after waiting.", "ERROR");
            }
        } catch (e) {
            // Log any errors that occurred while saving the image
            updateLog("Error saving image: " + e.message);
        }
    }

    // After capturing all images, attempt to disconnect the camera.
    try {
        // Set LinkEnabled to false to disconnect the camera.
        ccdCameraCamera.LinkEnabled = false;

        // Log that the camera was disconnected suggessfully.
        updateLog("Camera disconnected.", "INFO");
    } catch (e) {
        // Log any errors encountered during the disconnection process.
        updateLog("An error occurred: " + e.message, "ERROR");
    }
}

// RunColibri Functions
var SUP;

String.prototype.trim = function() {
    return this.replace(/(^\s*)|(\s*$)/g, "");
}

/////////////////////
// Aborts script
// MJM - 2021-06-24
/////////////////////
function abort() {
    Console.PrintLine("Aborting script!");
    ts.WriteLine(Util.SysUTCDate + "ERROR: Aborting script!");
    shutDown();
    while (Dome.ShutterStatus !=1 || Telescope.AtPark != true) {
        Util.WaitForMilliseconds(5000);
        Console.PrintLine("Waiting 5 seconds for shutter to close and telescope to park...");
    }
    
    if (Util.ScriptActive) {
        Console.PrintLine("Aborting...");
        Util.AbortScript();
    }

    while (Util.ScriptActive) {
        Console.PrintLine("Waiting for script to finish...");
    }
}

function abortAndRestart() {
    Console.PrintLine("Aborting script!");
    ts.WriteLine(Util.SysUTCDate + "ERROR: Aborting script! Restarting script!");
    shutDown();
    while (Dome.ShutterStatus != 1 || Telescope.AtPark != true) {
        Util.WaitForMilliseconds(5000);
        Console.PrintLine("Waiting 5 seconds for shutter to close and telescope to park...");
    }

    if (Util.ScriptActive) {
        Console.PrintLine("Aborting...");
        Util.AbortScript();
    }

    while (Util.ScriptActive) {
        Console.PrintLine("Waiting for script to finish...");
    }

    main();
}

function andRestart(){
    Console.PrintLine("Shutting down and restarting!");
    shutDown();

    while (Dome.ShutterStatus != 1 || Telescope.AtPark != true) {
        Util.WaitForMilliseconds(5000);
        Console.PrintLine("Waiting 5 seconds for shutter to close and telescope to park...");
    }

    main();
}

//////////////////////////////////////////////////
// Function called when Alert button is pressed
//////////////////////////////////////////////////
function alert(){
    Console.alert(consIconWarning, "Quiting script!");
    shutDown();
    abort();
}

///////////////////////////
// Function to connect the telescope
// MJM -
///////////////////////////
function connectScope() {
    // Check to see if telescope is connected. If not, try to connect to it.
    if (Telescope.Connected) {
        Console.PrintLine("Telescope is connected!");
        trkOn();
    } else {
        Console.PrintLine("Telescope is not connected. Attempting to connect...");
        Telescope.Connected = "True";
        trkOn();
        
        if (Telescope.Connected) {
            Console.PrintLine("Telescope is now connected!");
            trkOn();
        } else {
            Console.PrintLine("Telescope is still not connected. There must be a problem. :-(");
            abort();
        }
    }
    Console.PrintLine(" ");
}

///////////////////////////
// Function to close dome
// MJM -
///////////////////////////
function domeClose() {
    switch (Dome.ShutterStatus) {
        //////////////////
        // Dome is open //
        //////////////////
        case 0:
            Console.PrintLine("--> Dome shutter is open.");
            Dome.CloseShutter();
            Util.WaitForMilliseconds(4000);

            while (Dome.ShutterStatus == 3) {
                Console.PrintLine("*** Dome shutter is closing...");
                Util.WaitForMilliseconds(2000);
            }

            if (Dome.ShutterStatus == 0) {
                Console.PrintLine("--> Dome shutter is open...");
                
            } else {
                Console.PrintLine("--> Dome is NOT open.");
            }

            break;

        ////////////////////
        // Dome is closed //
        ////////////////////
        case 1:
            Console.PrintLine("--> Dome shutter is already closed :-P");
            break;

        ////////////////////////
        // Shutter is opening //
        ////////////////////////
        case 2:
            while (Dome.ShutterStatus == 2) {
                Console.PrintLine("*** Dome shutter is opening...");
                Util.WaitForMilliseconds(2000);
            }

            Console.PrintLine("--> Dome shutter is opened...");
            Util.WaitForMilliseconds(500);

            Dome.CloseShutter();
            Util.WaitForMilliseconds(4000);

            while (Dome.ShutterStatus == 3) {
                Console.PrintLine("*** Dome shutter is closing...");
                Util.WaitForMilliseconds(2000);
            }

            break;

        ////////////////////////////////////
        // Dome is closing. Let it close. //
        ////////////////////////////////////
        case 3:
            while (Dome.ShutterStatus == 3) {
                Console.PrintLine("*** Dome shutter is closing. Waiting for it close...");
                Util.WaitForMilliseconds(2000);
            }
            
            Console.PrintLine("--> Dome shutter is closed...");
            break;

        /////////////////////////////////
        // Houston, we have a problem. //
        /////////////////////////////////
        case 4:
            Console.PrintLine("There was a problem with the shutter control...");
            return;
    }

    // Check to see if the dome is closed or in error
    if (Dome.ShutterStatus != 1) {
        Console.PrintLine("Dome is not closed. Trying again...");
        Util.WaitForMilliseconds(1000);
        domeClose();
    }
}

///////////////////////////
// Function to home dome.
// MJM -
///////////////////////////
function domeHome(){
    ////////////////////////////////////////
    // Home the dome if not already done. //
    ////////////////////////////////////////
    if (!Dome.AtHome) {
        Util.WaitForMilliseconds(2000);

        Dome.FindHome();

        while (!Dome.AtHome) {
            Console.PrintLine("*** Homing dome...");
            Util.WaitForMilliseconds(2000);
        }
        Console.PrintLine("--> Dome is homed... Bigly.");
    }
    Dome.UnparkHome();
}

///////////////////////////
// Function to open dome.
// MJM
///////////////////////////
function domeOpen() {
    switch (Dome.ShutterStatus) {
        // Dome is open
        case 0:
            Console.PrintLine("--> Dome shutter is already open :-P");
            break;

        // Dome is closed
        case 1:
            Console.PrintLine("--> Dome shutter is closed.");
            Dome.OpenShutter();
            Util.WaitForMilliseconds(500);

            while (Dome.ShutterStatus == 2) {
                Console.PrintLine("*** Dome shutter is opening...");
                Util.WaitForMilliseconds(2000);
            }

            if (Dome.ShutterStatus == 0) {
                Console.PrintLine("--> Dome shutter is open...");
            } else { Console.PrintLine("--> Dome is NOT open."); }
                
            break;

        case 2:
            while (Dome.ShutterStatus == 2) {
                Console.PrintLine("*** Dome shutter is open...");
                Util.WaitForMilliseconds(2000);
            }
            Console.PrintLine("--> Dome shutter is opened...");
            break;

        // Dome is closing. Let it close and then open it.
        case 3:
            while (Dome.ShutterStatus == 3) {
                Console.PrintLine("*** Dome shutter is closing. Waiting for it close...");
                Util.WaitForMilliseconds(2000);
            }
            
            Dome.OpenShutter();
            Util.WaitForMilliseconds(500);

            while (Dome.ShutterStatus == 2) {
                Console.PrintLine("*** Dome Shutter is opening.");
                Util.WaitForMilliseconds(60000);
            }

            Console.PrintLine("--> Dome shutter is open...");
            break;

        // Houston, we have a problem.
        case 4:
            Console.PrintLine("There was a problem with the shutter control...")
            break;
    }

    // Home the dome if not already done.
    if (!Dome.AtHome) {
        Dome.FindHome();
        while (!Dome.AtHome) {
            Console.PrintLine("*** Homing dome...");
            Util.WaitForMilliseconds(2000);
        }
        Console.PrintLine("--> Dome is homed... Bigly.");
    }
}




/////////////////////////////////////////////////////
// Return the coordinates of the moon in RA and Dec
// MJM - 2021/06/24
/////////////////////////////////////////////////////
function getMoon() {
	// finding moon elevation and azimuth
    Util.Console.PrintLine("== Moon Coordinates ==");
    ts.WriteLine(Util.SysUTCDate + " INFO: == Moon Coordinates ==");
    var SH = new ActiveXObject("WScript.Shell");
    Console.PrintLine(ACPApp.Path);
    var BS = SH.Exec(ACPApp.Path + "\\aa.exe -moon");
    var coords = "";

    while(BS.Status != 1) {
        while(!BS.StdOut.AtEndOfStream) {
            coords += BS.StdOut.Read(1);
        }
        Util.WaitForMilliseconds(100);
    }
    coords = coords.trim();
    Util.Console.PrintLine("== " + coords + " ==");
    ts.WriteLine(Util.SysUTCDate + " INFO: " + coords);

    var bits = coords.split(" ");

    var ct = Util.NewCThereAndNow();
    ct.RightAscension = bits[0];
    ct.Declination = bits[1];

    return ct;
}

function getRADEC() {
    var ras, des;
    
    // Get scope J2000 RA/Dec
    if(Prefs.DoLocalTopo) {
        SUP.LocalTopocentricToJ2000(Telescope.RightAscension, Telescope.Declnation);
        ras = SUP.J2000RA;
        des = SUP.J2000Dec;
    } else {
        ras = Telescope.RightAscension;
        des = Telescope.Declination;
    }

    return {ra: ras, dec: des};
}

///////////////////////////////////////////
// Sends scope to a particular Alt and Az
// MJM
///////////////////////////////////////////
function gotoAltAz(alt, az) {
    breakme: if (ct.Elevation < elevationLimit) {
        Console.PrintLine("Tried to move to an unsave elevation of " + ct.Elevation.toFixed(4));
        ts.WriteLine(Util.SysUTCDate + " WARNING: Tried to move to an unsave elevation of " + ct.Elevation.toFixed(4));
        ts.WriteLine(Util.SysUTCDate + " WARNING: Closing up shop!");
        shutDown();
        Console.PrintLine("Finished closing up shop.");
        ts.WriteLine(Util.SysUTCDate + " INFO: Finished closing up shop!");
        break breakme;
    }

    if (Telescope.tracking) {
        Telescope.SlewToAltAz(alt, az);
        Util.WaitForMilliseconds(100);

        while (Telescope.Slewing) {
            Console.PrintLine("Going to...");
            Util.WaitForMilliseconds(2000);
        }
        Console.PrintLine("Done.");
    }
}

///////////////////////////////////////////
// Sends scope to a particular RA and DEC
// MJM
///////////////////////////////////////////
function gotoRADec(ra, dec) {
    Console.Printline("RA in gotoRADec function " + ra.toFixed(4));
    Console.Printline("Dec in gotoRADec function " + dec);

    var targetCt = Util.NewCThereAndNow();
    targetCt.RightAscension = ra;
    targetCt.Declination = dec;

    // Print target elevation to screen
    Console.Printline("Elevation of field " + targetCt.Elevation.toFixed(4));

    breakme: if (targetCt.Elevation < elevationLimit) {
        Console.PrintLine("Tried to move to an unsave elevation of " + targetCt.Elevation.toFixed(4));
        ts.WriteLine(Util.SysUTCDate + " WARNING: Tried to move to an unsave elevation of " + targetCt.Elevation.toFixed(4));
        ts.WriteLine(Util.SysUTCDate + " INFO: Closing up shop!");
        shutDown();
        ts.WriteLine(Util.SysUTCDate + " INFO: Finished closing up shop!");
        break breakme;
    }

    if (Telescope.tracking) {   
        Console.Printline("Slewing to declination " + dec + " and right ascension " + ra.toFixed(4));
        ts.WriteLine(Util.SysUTCDate + " INFO: Slewing to declination " + dec + " and right ascension " + ra.toFixed(4));

        // Need to put a check in for 'incomplete' coordinates. Not sure what this means as it doesn't
        // seem to be a problem with ACP, but a problem with the AP driver. Let's try either restarting
        // script after error or just repeating this function on error return, if possible. Try/catch/finally
        // statement.

        try {
            Telescope.SlewToCoordinates(ra.toFixed(4), dec.toFixed(4));
        } catch(e) {
            if (slewAttempt < 10) {
                Console.PrintLine("Error on attempt" + slewAttempt + "to slew. Waiting 5 seconds and trying again.");
                ts.WriteLine("Error on attempt" + slewAttempt + "to slew. Waiting 5 seconds and trying again.");
                Util.WaitForMilliseconds(5000);
                gotoRADec(ra, dec);
                slewAttempt += 1;
            } else {
                Console.PrintLine("Reached maximum number of tries to slew");
                ts.WriteLine("ERROR: Reached maximum number of slew attempts");
            }
        }
        Console.PrintLine("Done slewing.");
    }
}

//////////////////////////////////////////////////////////////
// Function to adjust telescope pointing. Calls astrometry_correction.py
// subprocess to get new pointing.
//////////////////////////////////////////////////////////////

function adjustPointing(ra, dec) {
    // Convert RA to decimal degrees
    ra = ra * 15;

    // Call astrometry_correction.py to get pointing offset
    Console.PrintLine("== Pointing Correction ==");
    ts.WriteLine(Util.SysUTCDate + " INFO: == Pointing Correction ==");
    var SH = new ActiveXObject("WScript.Shell");
    // var BS = SH.Exec("python ExtraScripts\\astrometry_correction.py " + ra + " " + dec);
    var BS = SH.Exec("python ..\\astrometry_correction.py " + ra + " " + dec);
    var python_output = "";
    var python_error = "";

    var start = new Date().getTime();
    var timeout = 300000; // Timeout in milliseconds (5 minutes)
    
    Console.PrintLine("Script started at: " + start);
    ts.WriteLine(Util.SysUTCDate + " INFO: Script started at: " + start);

    // Added an escape here in case the Python script hangs.
    while (BS.Status == 0) { 
        while (!BS.StdOut.AtEndOfStream) {
            python_output += BS.StdOut.Read(1);
        }
        while (!BS.StdErr.AtEndOfStream) {
            python_error += BS.StdErr.Read(1);
        }
        Util.WaitForMilliseconds(100);

        var currentTime = new Date().getTime();
        Console.PrintLine("Current Time: " + currentTime);
        ts.WriteLine(Util.SysUTCDate + " INFO: Current Time: " + currentTime);

        if (currentTime - start > timeout) {
            Console.PrintLine("Python script timed out.");
            ts.WriteLine(Util.SysUTCDate + " ERROR: Python script timed out.");
            BS.Terminate();
            return;
        }
    }

    var end = new Date().getTime();
    Console.PrintLine("Script ended at: " + end);
    ts.WriteLine(Util.SysUTCDate + " INFO: Script ended at: " + end);
    Console.PrintLine("Script duration: " + (end - start) + " ms");
    ts.WriteLine(Util.SysUTCDate + " INFO: Script duration: " + (end - start) + " ms");

    if (python_error) {
        Console.PrintLine("Python script error output: " + python_error);
        ts.WriteLine(Util.SysUTCDate + " ERROR: Python script error output: " + python_error);
    }

    // Parse output from astrometry_correction.py
    var py_lines = python_output.split("\n");
    var radec_offset = py_lines[py_lines.length - 2].split(" ");

    // Calculate new RA and Dec pointing
    var new_ra = (ra + parseFloat(radec_offset[0])) / 15;
    var new_dec = dec + parseFloat(radec_offset[1]);

    // Print new pointing
    Console.PrintLine("New RA: " + new_ra.toString() + " New Dec: " + new_dec.toString());
    ts.WriteLine(Util.SysUTCDate + " INFO: New RA: " + new_ra.toString());
    ts.WriteLine(Util.SysUTCDate + " INFO: New Dec: " + new_dec.toString());

    // Check that new pointing is reasonable
    if (isNaN(new_ra) || isNaN(new_dec)) {
        Console.PrintLine("New pointing is not a number. Ignoring new pointing and continuing with current pointing.");
        ts.WriteLine(Util.SysUTCDate + " WARNING: New pointing is not a number. Ignoring new pointing and continuing with current pointing.");
        return;
    } else if ((new_ra > 24 || new_ra < 0) || (new_dec > 90 || new_dec < -90)) {
        Console.PrintLine("New pointing is not reasonable. Ignoring new pointing and continuing with current pointing.");
        ts.WriteLine(Util.SysUTCDate + " WARNING: New pointing is not reasonable. Ignoring new pointing and continuing with current pointing.");
        return;
    }

    // Check that new pointing is safe
    var targetCt = Util.NewCThereAndNow();
    targetCt.RightAscension = new_ra;
    targetCt.Declination = new_dec;
    if (targetCt.Elevation < elevationLimit) {
        Console.PrintLine("Tried to move to an unsafe elevation of " + targetCt.Elevation.toFixed(4));
        Console.PrintLine("Ignoring new pointing and continuing with current pointing.");
        ts.WriteLine(Util.SysUTCDate + " WARNING: Ignoring new pointing and continuing with current pointing.");
    } else {
        // Call gotoRADec() to slew to new pointing
        gotoRADec(new_ra, new_dec);
    }
}

///////////////////////////////////////////////////////////////
// Shuts down the telescope and dome after observations are complete.
// Turns off tracking, parks the telescope, and closes the dome.
// Also handles updating the schedule for incomplete observations (currently a placeholder)
// MJM - June 23, 2022
// Edited SMS - August 2024
///////////////////////////////////////////////////////////////
function shutDown() {
    // Turn off tracking of the telescope.
    trkOff();
    updateLog("Tracking turned off. Parking telescope now.", "INFO");

    // Park the telescope safely.
    Telescope.Park();

    // Ensure tracking is off again after parking.
    trkOff();
    updateLog("Telescope parked. Closing dome now.", "INFO");

    // Close the observatory dome.
    domeClose();
    updateLog("Dome closed. Good night/morning.", "INFO");

    // TODO: Handkle incomplete observations (functionality not working yet)
    // Retrieve the list of requested observations; index[1] assumes it returns the lines of CSV data.
    var lines = getRequests()[1];

    // Loop through each observation line in the request data.
    for (var i = 0; i < lines.length; i++) {
        // Split the line by commas to parse the observation data.
        var data = lines[i].split(",");

        // Check if the observation was not completed.
        if (data[10] == 0) {
            // Log that the observation was not completed.
            updateLog("Observation " + line[0] + " was not completed.", "INFO");
            // Update the log indicating the observation is rescheduled for tomorrow.
            updateLog("Updating date and priority to be observed tomorrow.", "INFO");

            // Update the observation's start and end times by moving them to the next day.
            data[4] = updateDay(data[4]); // Update start date.
            data[5] = updateDay(data[5]); // Update end date.

            // Increase the priority.
            data[1] = parseInt(data[1]) + 1;
        }
    }
    
    // Save the updated observation schedule back to the CSV file.
    updateCSV(lines);
}

///////////////////////////////////////////////////////////////
// Function to turn tracking off. Liberated from BJD scripts.
///////////////////////////////////////////////////////////////
function trkOff() {
    if (Telescope.CanSetTracking) {
        Telescope.Tracking = false;
        Console.PrintLine("--> Tracking is turned off.");
    } else if (Telescope.Tracking && !Telescope.CanSetTracking) {
        Console.PrintLine("Failed to disable tracking");
        ts.WriteLine(" WARNING: Failed to disable telescope tracking");
    }
}

//////////////////////////////////////////////////////////////
// Function to turn tracking on. Liberated from BJD scripts.
//////////////////////////////////////////////////////////////
function trkOn() {
    if (Telescope.CanSetTracking) {
        Telescope.Unpark();
        Telescope.Tracking = true;
        Console.PrintLine("--> Tracking is turned on :-)");
    } else if (Telescope.Tracking && !Telescope.CanSetTracking) {
        Console.PrintLine("Failed to enable tracking");
        ts.WriteLine(" WARNING: Failed to enable telescope tracking");
    }
}

/////////////////////////////////////////////////////
// Returns astronomical twilight end (sunrise) and start (sunset) times of the current day as JD
// See: https://en.wikipedia.org/wiki/Sunrise_equation
// MJM - 2021/06
/////////////////////////////////////////////////////
function twilightTimes(jDate) {
	var lat = Telescope.SiteLatitude;
	var lon = Telescope.SiteLongitude;
	var n = Math.floor(jDate - 2451545.0 + 0.0008);
	var Jstar = n - (lon/360.0);
	var M = (357.5291 + 0.98560028 * Jstar) % 360;
	var C = 1.9148*Math.sin(Util.Degrees_Radians(M)) + 0.02*Math.sin(2*Util.Degrees_Radians(M)) + 0.0003*Math.sin(3*Util.Degrees_Radians(M));
	var lam = (M + C + 180 + 102.9372) % 360;
	var Jtransit = 2451545.0 + Jstar + 0.0053*Math.sin(Util.Degrees_Radians(M)) - 0.0069*Math.sin(2*Util.Degrees_Radians(lam));
	var sindec = Math.sin(Util.Degrees_Radians(lam)) * Math.sin(Util.Degrees_Radians(23.44));
	var cosHA = (Math.sin(Util.Degrees_Radians(-12)) - (Math.sin(Util.Degrees_Radians(lat))*sindec)) / (Math.cos(Util.Degrees_Radians(lat))*Math.cos(Math.asin(sindec)));
	var Jrise = Jtransit - (Util.Radians_Degrees(Math.acos(cosHA)))/360;
	var Jset = Jtransit + (Util.Radians_Degrees(Math.acos(cosHA)))/360;

	return [Jrise, Jset];
}

////////////////////////////////////////
// Causes program to wait until sunset
// MJM - 2021/06/24
////////////////////////////////////////
function waitUntilSunset(updatetime) {
	var currentJD = Util.SysJulianDate;
	while (currentJD < sunset) {
		Console.Clear();
		if (currentJD > sunrise && currentJD < sunset) {
			Console.PrintLine("Sun is up");
			Console.PrintLine("It has been up for " + Util.Hours_HMS((currentJD - sunrise)*24,"h ","m ","s"));
			Console.PrintLine("It will set in " + Util.Hours_HMS(-1*(currentJD - sunset)*24,"h ","m ","s"));
			Console.PrintLine("Waiting " + -1*(currentJD - sunset)*24 + " hours to start operations.");
			Util.WaitForMilliseconds(updatetime);
			currentJD = Util.SysJulianDate;
		}
	}
}
// END OF FUNCTIONS

// Global variables and configurations
// Variables used for logging and system state checks.
var logconsole = true; // Enable or disable logging the console output.
var firstRun = true; // Tracks whether the script is running for the first time.
var fso, f1, ts; // FileSystemObject and file variables for logging and file handling.
var currentDate = getDate(); // Store the current date.
var pierside = "E"; // Tracks which side the pier the telescope is on ("E" for East, "W" for West).
var maximDL; // Object for controlling MaxIM DL software.
var ccdCamera; // Object representing the CCD camera controlled by MaxIM DL.

// Magic numbers for astronomical limits
var elevationLimit = 10; // Minimum elevation angle for telescope pointing (degrees).
var minMoonOffset = 15; // Minimum allowed angular distance from the Moon (degrees).

// File handling constants for different file modes.
var ForReading = 1;
var ForAppending = 8;
var ForWriting = 2;

// A variable to track the number of telescope slew attempts.
var slewAttempt = 0;

// A variable to bypass requirements while testing.
var testing = true;

// Log to console and file if logging is enabled.
if (logconsole == true) {
    // Create a log file with a timestamped name and enable logging.
    Console.LogFile = "d:\\Logs\\ACP\\" + Util.FormatVar(Util.SysUTCDate, "yyyymmdd_HhNnSs") + "-ACPconsole.log";
    Console.Logging = true;
}

// Retrieve the sunset time from astronomical twilight data.
sunset  = twilightTimes(Util.SysJulianDate)[1]; // Sunset in Julian Date (JD)
LogFile = "d:\\Logs\\ACP\\" + JDtoUTC(sunset) + "-ACP.log"; // Log file path based on sunset time.

// Create an ActiveX FileSystemObject for file handling
fso = new ActiveXObject("Scripting.FileSystemObject");
    
// Check if the log file already exists.
if (fso.FileExists(LogFile)) {
    Console.PrintLine("Log file exists. Appending to existing log file.");
} else {
    // If the log file does not exist, create it.
    fso.CreateTextFile(LogFile);
}

// Open the log file for appending
f1 = fso.GetFile(LogFile);
ts = f1.OpenAsTextStream(ForAppending, true);
Console.PrintLine("Log file ready.")

// Main execution function.
function main() {
    try{
        updateLog("Attempting to create ActiveX object for MaxIM DL", "INFO");
        
        // Create ActiveX object for controlling MaxIM DL software
        maximDL = new ActiveXObject("MaxIm.Application");
        updateLog("MaxIM DL ActiveX object created successfully.", "INFO");
    
        // Access the CCD camera object from MaxIM DL.
        ccdCamera = maximDL.CCDCamera;
        updateLog("Accessing the CCD camera object", "INFO");
    } catch (e) {
        // Handle any errors during object creation or access.
        updateLog("An error occurred " + e.message, "ERROR");
    }

    // Calculate astronomical sunrise and sunset times (technically 12 degree twilight times) based on Julian Date.
    // twilightTimes: [0] - JD of sunrise, [1] - JD of sunset
    // Note! The calculation for sunsetLST only works if you are west of Greenwich
    sunset  = twilightTimes(Util.SysJulianDate)[1];
    sunrise = twilightTimes(Util.SysJulianDate + 1)[0];
    sunsetLST  = (Util.Julian_GMST(sunset)  + Telescope.SiteLongitude/15).toFixed(1);
    sunriseLST = (Util.Julian_GMST(sunrise) + Telescope.SiteLongitude/15).toFixed(1);

    // Get the current position of the Moon
    var moonCT = getMoon();

    // Calculate the total hours of darkness between sunset and sunrise.
    var darkHours = (sunrise - sunset)*24; // Length of night in hours.
    var timeUntilSunset = (sunset - Util.SysJulianDate)*24; // Hours until sunset.
    var timeUntilSunrise = (sunrise - Util.SysJulianDate)*24; // Hours until sunrise.

    // Calculate remaining dark hours.
    if (darkHours > timeUntilSunrise){
        darkHoursLeft = timeUntilSunrise;
    } else{
        darkHoursLeft = darkHours;
    }

    // Log astronomical times for today.
    updateLog("Sunrise GMST: " + Util.Julian_GMST(sunrise), "INFO");
    updateLog("Sunset GMST: " + Util.Julian_GMST(sunset), "INFO");
    updateLog("Current GMST: " + Util.Julian_GMST(Util.SysJulianDate), "INFO");
    updateLog("Sunrise UTC: " + Util.Julian_Date(sunrise), "INFO");
    updateLog("Sunset UTC: " + Util.Julian_Date(sunset), "INFO");
    updateLog("Sunset JD: " + sunset, "INFO");
    updateLog("Sunrise JD: " + sunrise, "INFO");
    updateLog("Current JD: " + Util.SysJulianDate, "INFO");
    updateLog("Length of the Night: " + darkHours + " hours", "INFO");
    updateLog("Time until sunset: " + timeUntilSunset + " hours", "INFO");
    updateLog("Time until sunrise: " + timeUntilSunrise + " hours");
    updateLog("Dark hours left: " + darkHoursLeft + " hours", "INFO");

    // Prestart checks for weather conditions
    // Check to see if the weather server is connected. If it isn't ask for permission to continue.

    if(testing){
        if(Util.Confirm("Testing is enabled. Do you want to continue? Time and Weather Checks will be bypassed.")){
            Console.PrintLine("Testing enabled.")
        }
        else{
            Console.PrintLine("Testing aborted.")
            abort();
        }
    }
	if (Weather.Available) {
        // If weather server is connected, log success and wait for 3 seconds.
            updateLog("Weather server is connected. Contining with operations.", "INFO");
            Util.WaitForMilliseconds(3000);
    } else {
        // If no weather server, ask for user confirmation to proceed.
        if (Util.Confirm("No weather server! Do you want to continue? Choose wisely...")) {
            updateLog("No weather server. You've chosen to proceed without.", "WARNING");
            ignoreWeather = true;
            Util.WaitForMilliseconds(3000);
        } else {
            // Abort if the user chooses not to continue without weather data.
            abort();
        }
    }
    
    // Handle unsafe weather conditions by waiting until conditions improve.
    if (Weather.Available && !Weather.safe && !testing) {
        updateLog("Weather unsafe! Waiting until it's looking a bit better out.", "INFO");
    }

    while (Weather.Available && !Weather.safe && !testing) {
        // If a new day starts, update the log file.
        if (getDate() != currentDate) {
            currentDate = getDate();

            // Define the log file path using the current sunset time in UTC format.
            LogFile = "d:\\Logs\\ACP\\" + JDtoUTC(sunset) + "-ACP.log";

            if (fso.FileExists(LogFile)) {
                Console.PrintLine(Util.SysUTCDate + " INFO: Log file exists. Appending to existing log file.");
            } else {
                fso.CreateTextFile(LogFile);
            }

            f1 = fso.GetFile(LogFile);
            try {
                ts = f1.OpenAsTextStream(ForAppending, true);
            } catch(err) {
                ts.WriteLine(Util.SysUTCDate + " WARNING: Log file is already open.");
            }
        }

        // Log and wait for 5 minutes before checking weather conditions again.
        updateLog("Unsafe weather conditions. Waiting for 5 minutes.", "INFO");
        Util.WaitForMilliseconds(300000)
    }
    
    // Ensure the currentDate variable is up to date.
    if (getDate() != currentDate) {
        // Update currentDate to today's date.
        currentDate = getDate();

        // Define the log file path using the current sunset time in UTC format.
        LogFile = "d:\\Logs\\ACP\\" + JDtoUTC(sunset) + "-ACP.log"

        // Check if the log file already exists.
        if (fso.FileExists(LogFile)) {
            // Inform the user that the log file exists and will be appended.
            Console.PrintLine("Log file exists. Appending to existing log file.");
        } else {
            // Create a new log file if it doesn't exist.
            fso.CreateTextFile(LogFile);
        }

        // Get a reference to the log file.
        f1 = fso.GetFile(LogFile);

        // Confirm the file exists again (possibly redundant check)
        if (fso.FileExists(LogFile)){
            Console.PrintLine("Log file exists. Appending to existing log file.");

        } else {
            // Open the log file in append mode for further logging
            ts = f1.OpenAsTextStream(ForAppending, true);
        }
    }

    // Observing Plan - Prepare for the first run
    // Create directory for tonight's data and collect dark frames if this is the first run.
	if (firstRun = true) {
        // Convert sunset time to UTC to define the data directory.
        var today = JDtoUTC(sunset);

        // Create the data directory for today's observations, including a subdirectory for dark frames.
        Util.ShellExec("cmd.exe", "/c mkdir -p d:\\ColibriData\\" + today.toString() + "\\Dark\\")
        
        // Log the creation of the directory.
        updateLog("Created today's data directory at d:\\ColibriData\\" + today.toString(), "INFO");
        
        // Mark that the first run is completed.
        firstRun = false
    }

    Console.PrintLine("Grabbing sheet");
    // Retrieve observation requests and their corresponding CSV lines.
    var csvData = getRequests();
    var requests = csvData[0]; // Observation requests
    var lines = csvData[1]; // Lines from the CSV file
    Console.PrintLine("Sheet Grabbed");

    // Begin the main observation loop.
    do {
        // Select the best observation based on the current conditions (sunset, sunrise, moon conditions, etc.)
        requests = transformAltAzToRadDec(requests); // Update RA and DEC coordinates for each observation request that has an altitude and azimuth.
        var bestObs = selectBestObservation(requests, sunset, sunrise, moonCT,testing);
        Console.PrintLine(bestObs)

        Console.PrintLine("Best Observation azimuth " + bestObs.Azimuth)
        if(bestObs.Azimuth != null){
            trkOff()
            Console.PrintLine("Azimuth provided, tracking turned off")
        }
        // Safeguard: Prevent observing before sunset
        // (This can be commented out for simulated testing during the day)
        while (Util.SysJulianDate < sunset && !testing) {
            updateLog("It's still too early to begin... Waiting for " + ((sunset - Util.SysJulianDate)*86400).toFixed(0) + " seconds.", "INFO");
            Util.WaitForMilliseconds(5000); // Wait for 5 seconds before checking again.
        }

        // Safeguard: Stop observing if it's past sunrise
        if (Util.SysJulianDate > sunrise && !testing) {
            updateLog("Too late. Nothing left to observe.", "INFO");
            andRestart(); // Restart the system
        }

        // Monitor the weather and check if it is safe to observe.
        if ((Weather.Available && Weather.safe) || (ignoreWeather == true) || testing) {
            Console.PrintLine("Checking Weather");
            connectScope(); // Connect to the telescope.
            domeOpen(); // Open the dome.
            trkOn(); // Turn on telescope tracking.
        }

        // If no suitable observation is found, wait for 5 minutes and retry.
        // TODO: Instead of waiting idly for 5 minutes when no suitable observations are found, add RunColibri KBO observation functionality.
        if (bestObs == "None") {
            Console.PrintLine("No suitable observation found in current conditions.")
            Console.PrintLine("Wait for 5 minutes and try again.")
            Util.WaitForMilliseconds(300000); // Wait for 5 minutes
            continue; // Continue to the next iteration of the loop.
        }

        // Log the selected observation details.
        // selectBestObservation returns a Request with properties: directoryName, priority, ra, dec, startUTC, startJD, endUTC, endJD, exposureTime, filter, binning, altitude, moonAngle, score, and csvIndex
        updateLog("Requested Observation Info", "INFO");
        updateLog("Directory Name: " + bestObs.directoryName, "INFO");
        updateLog("Priority: " + bestObs.priority, "INFO");
        updateLog("RA: " + bestObs.ra, "INFO");
        updateLog("Dec: " + bestObs.dec, "INFO");
        updateLog("Start UTC:" + bestObs.startUTC, "INFO");
        updateLog("Start JD: " + bestObs.startJD, "INFO");
        updateLog("End UTC: " + bestObs.endUTC, "INFO");
        updateLog("End JD: " + bestObs.endJD, "INFO");
        updateLog("Exposure Time: " + bestObs.exposureTime, "INFO");
        updateLog("Filter: " + bestObs.filter, "INFO");
        updateLog("Binning: " + bestObs.binning, "INFO");
        updateLog("Altitude: " + bestObs.altitude, "INFO");
        updateLog("Moon Angle: " + bestObs.moonAngle, "INFO");
        updateLog("Score: " + bestObs.score, "INFO");
        updateLog("CSV Index: " + bestObs.csvIndex, "INFO");

        // Create coordinate transform for the current request
        var currentFieldCt = Util.NewCThereAndNow();
        currentFieldCt.RightAscension = bestObs.ra / 15; // Convert RA from degrees to hours.
        currentFieldCt.Declination = bestObs.dec;

        // Log the coordinates to which the telescope will slew
        updateLog("Slewing to...", "INFO");
        updateLog("RA: " + currentFieldCt.RightAscension, "INFO");
        updateLog("Dec: " + currentFieldCt.Declination, "INFO");
        updateLog("Alt: " + currentFieldCt.Elevation, "INFO");
        updateLog("Az: " + currentFieldCt.Azimuth, "INFO");

        // Command the telescope to slew to the target field.
        gotoRADec(currentFieldCt.RightAscension, currentFieldCt.Declination);

        // Wait for the telescope and dome to finish slewing
        while (Telescope.Slewing == true) {
            Console.PrintLine("Huh. Still Slewing...");
            Util.WaitForMilliseconds(500); // Wait for 0.5 seconds between checks.
        }

        Dome.UnparkHome(); // Unpark the dome and move it to the home position.
        if (Dome.slave == false) { Dome.slave = true; } // Ensure the dome is slaved to the telescope.

        // Wait for the dome to finish slewing.
        while (Dome.Slewing == true) {
            Console.PrintLine("Dome is still slewing. Give me a minute...");
            Util.WaitForMilliseconds(500); // Wait for 0.5 seconds between checks
        }

        // Update the log when the telescope and dome have reached the target coordinates.
        updateLog("At target.", "INFO");
        updateLog("Target Alt/Az is: Alt. =" + currentFieldCt.Elevation.toFixed(2) + "   Az. = " + currentFieldCt.Azimuth.toFixed(2), "INFO");

        // Start collecting data for the observation
        updateLog("Starting data collection...", "INFO");

        // Attempt to link the camera for image capturing.
        try {
            if (!ccdCamera.LinkEnabled) {
                updateLog("Camera is not linked. Attempting to link...", "INFO");
                ccdCamera.LinkEnabled = true; // Enable the camera link.

                if (ccdCamera.LinkEnabled) {
                    updateLog("Camera linked successfully.", "INFO");
                } else {
                    updateLog("Failed to link the camera." , "ERROR");
                    return;
                }
            } else {
                updateLog("Camera already linked.", "INFO");
            }
        } catch (e) {
            updateLog("An error occurred: " + e.message, "ERROR");
        }

        // Create directories for storing the captured images.
        Util.ShellExec("cmd.exe", "/c mkdir -p d:\\ColibriData\\" + today.toString() + "\\" + bestObs.directoryName)
        Util.ShellExec("cmd.exe", "/c mkdir -p d:\\ColibriData\\" + today.toString() + "\\Dark\\" + bestObs.directoryName)

        // Iteration counters for exposures and dark frames.
        var darkInterval = 30 / (bestObs.exposureTime / 60); // Calculate how many exposures fit into 30 minutes.
        var darkCounter = darkInterval; // Initialize the dark frame counter. Set equal to interval so that dark set is collected on first run.
        var runCounter = 1;

        var endJD = Util.SysJulianDate + (bestObs.obsDuration / 1440); // Calculate when the observation should end (in Julian Date)

        // Start a loop that runs while the current Julian Date is less than or equal to the observation's end time.
        while (Util.SysJulianDate <= endJD) {
            // Check if it's time to adjust the telescope pointing and take dark frames.
            // This happens either every 30 minutes or if the remaining observation time is less than 30 minutes.
            if (darkCounter == darkInterval) {
                // Log the start of telescope pointing adjustment using a child script.
                updateLog("Readjust the telescope pointing using child script.", "INFO");
                
                // Adjust the telescope pointing to the current target (Right Ascension and Declination).
                adjustPointing(currentFieldCt.RightAscension, currentFieldCt.Declination)
                
                // Wait for the telescope to finish slewing (moving to the target coordinates)
                while (Telescope.Slewing == true) {
                    Console.PrintLine("Huh. Still Slewing..."); // Inform the user the telescope is still slewing.
                    Util.WaitForMilliseconds(500); // Wait for 0.5 seconds before checking again.
                }

                // Unpark the dome and move it to its home position
                Dome.UnparkHome();

                // If the dome is not already slaved (automatically follows the telescope), enable slaving
                if (Dome.slave == false) { Dome.slave = true; }

                // Wait for the dome to finish slewing (moving to align with the telescope)
                while (Dome.Slewing == true) {
                    Console.PrintLine("Dome is still slewing. Give me a minute..."); // Inform the user that the dome is still moving
                    Util.WaitForMilliseconds(500); // Wait for 0.5 seconds before checking again
                }

                // Check the current side of the pier the telescope is on (East or West) and log it
                if (Telescope.SideOfPier == 0) {
                    pierside = "E"; // Telescope is on the East side of the pier
                } else {
                    pierside = "W"; // Telescope is on the West side of the pier
                }
                updateLog("Pier side: " + pierside, "INFO");
                
                // Log that the telescope is about to take dark frames (calibration images with no light).
                updateLog("Taking Darks.", "INFO");

                // Capture dark frames using the specified exposure time and save them to the designated directory.
                refCollection(2, bestObs.exposureTime, "D:\\ColibriData\\" + today.toString() + "\\Dark\\" + bestObs.directoryName);

                // Reset the dark frame counter to start counting again for the next interval.
                darkCounter = 0;
            }

            // Increment the dark frame counter to track when the next dark frame should be taken.
            darkCounter++;
            updateLog("Dark counter = " + darkCounter.toString(), "INFO"); // Log the updated dark frame counter value.

            // Attempt to start a new exposure for the observation.
            try {
                updateLog("Starting exposure...", "INFO");

                // Set the binning (resolution) of the camera based on the observation parameters.
                ccdCamera.BinX = bestObs.binning;
                ccdCamera.BinY = bestObs.binning;

                // Begin the exposure with the specified exposure time and filter.
                // The exposure time is expected in seconds.
                ccdCamera.Expose(bestObs.exposureTime, bestObs.filter);

                // Log a successful start of the exposure.
                updateLog("Exposure started successfully", "INFO");
            } catch (e) {
                // Log an error if something goes wrong while starting the exposure.
                updateLog("Error starting exposure: " + e.message, "ERROR");
            }

            // Wait for the image to be ready after the exposure.
            var maxWaitTime = bestObs.exposureTime * 1000; // Maximum wait time (the exposure time), in milliseconds.
            var waitInterval = 1000; // Check every 1000ms (1 second).
            var elapsedTime = 0; // Initialize the elapsed time counter.

            try {
                // Wait for the camera to signal that the image is ready, or until the maximum wait time is reached.
                while (!ccdCamera.ImageReady && elapsedTime < maxWaitTime) {
                    Util.WaitForMilliseconds(waitInterval); // Wait for the defined interval (1 second).
                    elapsedTime += waitInterval; // Increment the elapsed time by the interval.
                }

                // If the image is ready, save it to the specified file path.
                if (ccdCamera.ImageReady) {
                    var filePath = "D:\\ColibriData\\" + today.toString() + "\\" + bestObs.directoryName + "\\image_" + new Date().getTime() + "_" + bestObs.exposureTime + "s.fits"; 
                    updateLog("Saving image to: " + filePath, "INFO");  // Log the file path where the image will be saved.
                    ccdCamera.SaveImage(filePath); // Save the image to the specified path.
                    updateLog("Image saved successfully to: " + filePath, "INFO");// Log the successful image save.
                } else {
                    // Log an error if the image is not ready after the maximum wait time.
                    updateLog("Image not ready after waiting.", "ERROR");
                }
            } catch (e) {
                // Log an error if something goes wrong during image saving.
                updateLog("Error saving image: " + e.message, "ERROR");
            }
            
            // Increment the run counter after each successful exposure.
            runCounter++;
        }

        // Attempt to safely disconnect from the camera after all exposures are complete.
        try {
            ccdCameraCamera.LinkEnabled = false; // Disable the camera link (disconnect).
            updateLog("Camera disconnected.", "INFO"); // Log the successful camera disconnection.
        } catch (e) {
            // Log an error if something goes wrong while disconnecting the camera.
            updateLog("An error occurred: " + e.message, "ERROR");
        }

        // Mark requested observation as completed in the CSV file.
        try {
            // Ensure the CSV index is valid and within the bounds of the observation requests array.
            if (bestObs.csvIndex >= 0 && bestObs.csvIndex < lines.length) {
                var rowData = lines[bestObs.csvIndex].split(","); // Split the CSV row into an array of data.

                // Modify the necessary column (e.g., column 10) to mark the observation as completed.
                rowData[10] = 1;

                // Join the array back into a CSV-formatted string
                lines[bestObs.csvIndex] = rowData.join(",");
            } else {
                // Log an error if the CSV index is out of range or if the file is empty.
                updateLog("Index out of range or file is empty.", "ERROR");
                updateLog("CSV Index: " + bestObs.csvIndex, "INFO");
            }

            // Update the CSV file with the modified data.
            updateCSV(lines);
        } catch (e) {
            // Log an error if something goes wrong while updating the CSV file.
            updateLog("Error: " + e.message, "ERROR");
        }

        // Fetch the next set of observation requests.
        requests = getRequests()[0];

        // Log the remaining observation requests and print the updated observation plan.
        updateLog("Remaining requests: " + requests.length, "INFO");
        updateLog("Updated Plan:", "INFO");
        printPlan(requests);

    // Continue the loop if there are still observation requests remaining.
    } while (requests.length > 0);

    // Safely shut down the system after all observation requests have been processed.
    shutDown();
}
