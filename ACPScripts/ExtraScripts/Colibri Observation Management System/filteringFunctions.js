import { calculateAltitude, calculateMoonAngle } from "./astronomicalCalculations";
// Filters the observation requests by checking if they fall within the allowed time window and between sunset and sunrise.
function filterByTime(requests, sunset, sunrise, testing) {
    var filteredObs = [];

    if(!testing){
    var currJD = Util.SysJulianDate; // Get the current Julian Date.
    }
    else{
        Console.PrintLine("TESTING adding .2 to jd")
        currJD = sunset + .2;
    }


    // Loop through each request and check if it fits within the time window and sunset/sunrise.
    for (var i = 0; i < requests.length; i++) {
        var request = requests[i];
        // Add to filteredObs if the request is within the time window.
        if (withinTimeWindow(request, currJD, sunset, sunrise)) { filteredObs.push(request); }
    }

    return filteredObs; // Return the filtered list of requests.
}

// Filters the observation requests by checking if they meet certain astronomical conditions (e.g., target altitude and distance from the moon).
function filterByAstronomy(requests, moonCT, testing) {
    var filteredObs = [];
    

    if(!testing){
        var currLST = Util.NowLST(); // Get the current Local Sidereal Time.
        }
        else{
            Console.PrintLine("Testing Adjusting Sidereal time")
            currLST = 20
            Console.PrintLine("Sidereal time" + currLST)
        }
    

    // Loop through each request and check if it meets the astronomical conditions.
    for (var i = 0; i < requests.length; i++) {
        var request = requests[i];
        // Add to filteredObs if the request meets the astronomy conditions.
        if (meetsAstronomyConditions(request, moonCT, currLST)) { filteredObs.push(request); }
    }

    return filteredObs; // Return the filtered list of requests.
}

// Checks if an observation request fits within the allowed time window and between sunset and sunrise.
function withinTimeWindow(request, currJD, sunset, sunrise) {
    var startWindow = request.startJD;  // Start time of the observation request (in Julian Date).
    var endWindow = request.endJD;      // End time of the observation request (in Julian Date).

    // Calculate the end time of the observation in Julian Date.
    var endJD = currJD + (request.obsDuration / 1440); // obsDuration is in minutes, dividing by 1440 gives days.

    // Check if the observation fits within the time window and returns true if it does.
    return startWindow <= currJD && currJD <= endWindow && endJD <= sunrise && sunset <= startWindow && startWindow <= sunrise && sunset <= endWindow && endWindow <= sunrise;
}


// Checks if the observation request meets the required astronomical conditions (elevation above a limit and minimum moon angle).
function meetsAstronomyConditions(request, moonCT, newLST) {
    var ra = request.ra;    // Right Ascension of the target.
    var dec = request.dec;  // Declination of the target.
    
    // Calculate the altitude of the target at the current Local Sidereal Time (LST).
    var targetAltitude = calculateAltitude(ra, dec, newLST);
    // Calculate the angular distance between the target and the moon.
    var moonAngle = calculateMoonAngle(ra, dec, moonCT);

    // Store the calculated values in the request object.
    request.altitude = targetAltitude;
    request.moonAngle = moonAngle;

    // Return true if the target's ltitude is above the elevation limit and if the moon's angle is greater than the minimum offset.
    Console.PrintLine("TARGET: " + request.directoryName)
    Console.PrintLine("targetAltitude > elevationLimit " + (targetAltitude > elevationLimit));
    Console.PrintLine("moonAngle > minMoonOffset " + (moonAngle > minMoonOffset));
    return targetAltitude > elevationLimit && moonAngle > minMoonOffset;
}

export { filterByTime, filterByAstronomy };

