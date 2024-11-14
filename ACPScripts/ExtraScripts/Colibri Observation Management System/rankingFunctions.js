// Ranks the observation requests by calculating a score for each one, and then sorts them in descending order based on that score.
function rankObservations(requests) {
    var rankedObs = [];

    // Loop through each request and calculate its score.
    for (var i = 0; i < requests.length; i++) {
        var request = requests[i];
        calculateScore(request); // Calculate and assign a score to each request.
    }

    // Sort the request in descending order based on their scores.
    rankedObs = requests.sort(function (request1, request2) { 
        return request1.compareScore(request2); // Use the compareScore method to determine the order.
    });

    return rankedObs; // Return the ranked list of observation requests.
}

// Calculates the overall score for an observation request based on its priority, timing, and astronomical conditions.
function calculateScore(request) {
    var score = request.priority * 50; // Give priority extra weight (multiplied by 50).

    // Add the scores from time and astronomy conditions to the total score.
    score += evaluateTimeScore(request);
    score += evaluateAstronomyScore(request);

    request.score = score; // Assign the calcualted score to the request.
}

// Calculates score based on the observation's time window (how long the observation lasts).
function evaluateTimeScore(request) {
    // Convert the start and end times from Julian date to seconds since Unix Epoch.
    var startSec = (request.startJD - 2440587.5) * 86400;
    var endSec = (request.endJD - 2440587.5) * 86400;

    // Return the observation's duration in minutes (with a minimum score of 0).
    return Math.max(0, (endSec - startSec) / 60); // Duration in minutes
}

// Calculates the score based on the observation's astronomical conditions (e.g., altitude and distance from the moon).
function evaluateAstronomyScore(request) {
    // Calculate the score based on how much the altitude exceeds the elevation limit.
    var altitudeScore = Math.max(0, request.altitude - elevationLimit);
    // Calculate the score based on how much the moon angle exceeds the minimum moon offset.
    var moonScore = Math.max(0, request.moonAngle - minMoonOffset);

    // Return the sum of the altitude and moon angle scores.
    return altitudeScore + moonScore;
}

export { rankObservations };