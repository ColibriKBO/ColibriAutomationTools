// Auxiliary functions
// Updates the day in a time string.
function updateDay(timeString) {
    var parts = timeString.split(":"); // Split the time string into parts.
    var day = parseInt(parts[2]) + 1; // Parse the day and increment by 1.
    // Ensure that the day part is formatted with a leading zero if necessary.
    parts[2] = (day < 10 ? "0" : "") + day;
    // Recombine the parts into a single time string and return it.
    return parts.join(":");
}

// Updates the CSV file with new lines while preserving the header row.
// 'lines' parameter is expected to be an array of strings representing the new date to be added.
function updateCSV(lines) {
    try {
        // Open the existing CSV file for reading.
        var readFile = fso.OpenTextFile('./colibri_user_observations.csv', ForReading);
        var header = readFile.ReadLine(); // Read and store the first line (header).
        readFile.Close(); // Close the file after reading the header.

        // Open the CSV file again, but this time for writing (overwriting the file).
        var writeFile = fso.OpenTextFile('./colibri_user_observations.csv', ForWriting);

        // Write the new lines of data to the file.
        for (var i = 0; i < lines.length; i++) {
            writeFile.WriteLine(lines[i]); // Write each line from the 'lines' array to the file.
        }
        writeFile.Close(); // Close the file after writing.

        // Log a success message indicating that the CSV file was modified.
        updateLog("CSV File modified successfully.", "INFO");
    } catch (e) {
        // In case of an error (e.g., file access issues), log the error message.
        updateLog(e.message, "ERROR");
    }
}

// Logs and prints the current observation plan.
// 'plan' is an array of observation requests, each containing details like start time, end time, RA, Dec, etc. 
function printPlan(plan) {
    // Log a header indicating the start of the current plan display.
    updateLog("=== Current Plan ===", "INFO");
    
    // Loop through each observation request in the plan and log its details.
    for (var i = 0; i < plan.length; i++) {
        var request = plan[i]; // Get the current observation request.
        // Log the directory name, start and end times, (in both UTC and JD), and score the request.
        updateLog(request.directoryName + " starts " + request.startUTC + " (" + request.startJD + ") ends " + request.endUTC + " (" + request.endJD + ") with score " + request.score, "INFO");
        // Log additional details including RA, Dec, altitude, and moon angle of the request.
        updateLog("RA: " + request.ra + " Dec: " + request.dec + " Alt: " + request.alt + " Moon Angle: " + request.moonAngle, "INFO");
    }
}

// Updates the log with the given message and type (e.g., INFO or ERROR).
// 'contents' is the message to log, 'type' is the log type (INFO, ERROR, etc.).
function updateLog(contents, type) {
    // Print the log message to the console.
    Console.PrintLine(contents);
    // Write the log message to a file with a timestamp, type, and the log content.
   // ts.writeLine(Util.SysUTCDate + " " + type + ": " + contents);
}

/////////////////////////////////////////////////////
// Returns available disk space
// freespace.bat must exist in the same directory
// as RunColibri.js as well as in the same directory
// as ACP.exe (c:\ProgramFiles(x86)\ACP) Obs Control
// MJM - Oct. 2022
/////////////////////////////////////////////////////
function freeDiskSpace() {
    var AX = new ActiveXObject("WScript.Shell");
    var SE = AX.Exec(ACPApp.Path + "\\freespace.bat");

    var size = "";

    size = SE.StdOut.Read(25);   // size in bytes
    size = size / 1000000000000; // size in TB

    return(size);
}

//////////////////////////////
// Returns date as yyyymmdd
// MJM - June 2021
//////////////////////////////
function getDate() {
	var d = new Date();
	var s = d.getUTCFullYear();
	
	var month = (d.getUTCMonth()+1).toString();
	var day = (d.getUTCDate()).toString();

	if (month.length == 1) {
		s += "0" + month;
	} else {
		s += month;
	}

	if (day.toString().length == 1) {
		s += "0" + day;
	} else {
		s += day;
	}
	return(s);
}

// Export the utility functions for use in other scripts.
export { updateDay, updateCSV, printPlan, updateLog, freeDiskSpace, getDate };