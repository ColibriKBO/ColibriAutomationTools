import { UTCtoJD } from "./Time.js";
// Scheduling observation request objects
// Request Object is used to represent scheduling observation requests.
// Each request contains details such as target coordinates, timing, exposure settings, and observation metadata.
function Request(directoryName, priority, ra, dec, alt, az, startUTC, startJD, endUTC, endJD, obsDuration, exposureTime, filter, binning, csvIndex) {
    // Directory name where the observation data will be saved.
    this.directoryName = directoryName;
    // Priority of the observation request (higher priority requests are scheduled first).
    this.priority = priority;

    // Right Ascension (RA) of the celestial target (in degrees).
    this.ra = ra;
    // Declination (DEC) of the celestial target (in degrees).
    this.dec = dec;

    // Altitude
    this.alt = alt;

    // Azimuth
    this.az = az;

    // Start time of the observation in UTC format (human-readable).
    this.startUTC = startUTC;
    // Start time of the observation in Julian Date (JD) format (for astronomical calculations).
    this.startJD = startJD;
    // End time of the observation in UTC format.
    this.endUTC = endUTC;
    // End time of the observation in Julian Date format.
    this.endJD = endJD;

    // Total duration of the observation (in minutes).
    this.obsDuration = obsDuration;
    // Time for a single exposure (in seconds).
    this.exposureTime = exposureTime;

    // Filter applied during the observation (1 for normal, 2 for dark, or 3 for biased)
    this.filter = filter;
    // Binning setting for the camera (1 for 1x1 or 2 for 2x2)
    this.binning = binning;

    // Altitude of the target during observation, initialized to 0 (calculated later).
    this.altitude = 0;
    // Angular distance between the target and the moon, initialized to 0 (calculated later).
    this.moonAngle = 0;

    // Score assigned to the request, used for sorting and prioritization.
    this.score = 0;
    // Index of the request in the CSV file (used to track and manage CSV data).
    this.csvIndex = csvIndex;

    // Method to compare the score of the current request with another request.
    // Returns true if the current request's score is higher, used for sorting requests.
    this.compareScore = function(otherRequest) { return this.score > otherRequest.score; };
}

// RequestIndices object maps the fields in a CSV file to corresponding observation request parameters.
// This class helps index fields when parsing observation requests from a CSV file.
function RequestIndices() {
    this.directoryName = 0;     // Index of the directory name in the CSV file.
    this.priority = 1;          // Index of the priority field.

    this.ra = 2;                // Index of the Right Ascension (RA) field.
    this.dec = 3;               // Index of the Declination (DEC) field.
    
    this.alt = 4;               // Index of the altitude field.
    this.az = 5;                // Index of the azimuth field.

    this.startTime = 6;         // Index of the observation start time field.
    this.endTime = 7;           // Index of the observation end time field.

    this.obsDuration = 8;       // Index of the observation duration field.
    this.exposureTime = 9;      // Index of the exposure time field.
    this.filter = 10;            // Index of the filter field.
    this.binning = 11;           // Index of the binning field.

    this.completion = 12;       // Index to track whether the observation request has been completed (1 for completed, 0 for uncompleted).
}

// Reads and parses observation requests from a CSV file.
// The function returns an array of Request objects along with the raw CSV data.
function getRequests() {
    var requests = [];  // Array to store the parsed Request objects.
    var lines = [];     // Array to store the raw lines from the CSV file.
    var indices = new RequestIndices(); // Object to map CSV fields to request parameters.

    try {
        // Create an ActiveX object for file system operations.
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        // Open the CSV file containing the observation request in read-only mode.
        var file = fso.OpenTextFile("./colibri_user_observations.csv", ForReading);

        var rowCounter = -1; // Counter to track the row index in the CSV file.
        var rowData = [];    // Array to hold the individual fields of a CSV row.

        // Loop through the CSV file line by line until reaching the end of the file.
        while(!file.AtEndOfStream) {
            if (rowCounter >= 0) { // Skip the header row (first row of the CSV).
                var line = file.ReadLine(); // Read a line from the CSV file.
                lines.push(line); // Add the raw line to the lines array.
                rowData = line.split(","); // Split the line by commas to get individual fields.
                
                // Check if the observation request has not been completed (completion field is 0).
                Console.PrintLine("At " + rowData[indices.directoryName])
                if (rowData[indices.completion] == 0) {
                    // Create a new Request object using the parsed CSV fields.
                    var request = new Request(
                        rowData[indices.directoryName], // Directory name.
                        parseInt(rowData[indices.priority]), // Priority as an integer.
                        parseFloat(rowData[indices.ra]), // Right Ascension as a float.
                        parseFloat(rowData[indices.dec]), // Declination as a float.
                        parseFloat(rowData[indices.alt]), // Altitude as a float.
                        parseFloat(rowData[indices.az]), // Azimuth as a float.
                        rowData[indices.startTime], // Start time in UTC.
                        UTCtoJD(rowData[indices.startTime]), // Convert start time to Julian Date.
                        rowData[indices.endTime], // End time in UTC.
                        UTCtoJD(rowData[indices.endTime]), // Convert end time to Julian Date.
                        parseInt(rowData[indices.obsDuration]), // Observation duration as an integer.
                        parseFloat(rowData[indices.exposureTime]), // Exposure time as a float.
                        rowData[indices.filter], // Filter used for the observation.
                        rowData[indices.binning], // Binning setting.
                        rowCounter // Index of the request in the CSV file.
                    );
                   
                    // Add the newly created Request to the array.
                    requests.push(request);
                }
            }
            // Increment the row counter to move to the next line.
            rowCounter++;
        }
        file.Close(); // Close the CSV file after reading all lines.
        fso = null; // Release the FileSystemObject.
    } catch (e) {
        // Print an error message to the console if an exception occurs.
        Console.PrintLine("An error occurred: " + e.message);
    }

    // Return the array of Request objects and the raw CSV lines.
    return [requests, lines];
}

////////////////////////////////////////
// Update RA and DEC in Request array which have an altitude and azimuth
// NB - 2024/11/7
////////////////////////////////////////

function transformAltAzToRadDec(requests) {
    for (var i = 0; i < requests.length; i++) {
        var request = requests[i];
        
        Console.PrintLine("Before " + request.directoryName)
        Console.PrintLine(request.directoryName + "Altitude " + request.alt)
        // Check if altitude and azimuth values are provided
        if (request.alt != null && request.az != null) {
            Console.PrintLine("!!!Updating" + request.directoryName);
            // Create a new coordinate transformation object using current LST and site latitude
            var ct = Util.NewCT(Telescope.SiteLatitude, Util.NowLST());
            
            // Set Altitude and Azimuth, which should trigger the conversion to RA/Dec
            ct.Altitude = request.altitude;
            ct.Azimuth = request.azimuth;
            
            // Retrieve the converted RA and Dec values
            requests[i].RightAscension = ct.RightAscension;
            requests[i].Declination = ct.Declination;
        }
    }

    return requests;
}

// Export the getRequests function to make it accessible to other scripts.
export { getRequests, RequestIndices, Request, transformAltAzToRadDec };