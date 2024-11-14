import { filterByAstronomy, filterByTime } from "./filteringFunctions";
import { rankObservations } from "./rankingFunctions";


// Selects the best observation from a list of requests, based on various filtering and ranking criteria.
function selectBestObservation(requests, sunset, sunrise, moonCT, testing) {
    // Log and print the list of requests before filtering.
    updateLog("Requests before filtering.", "INFO");
    printPlan(requests);

    // Filter out observations that don't fit within the time window or between sunset and sunrise.
    var suitableObs = filterByTime(requests, sunset, sunrise, testing);
    // Log and print the list of requests after time filtering.
    updateLog("Requests after time filtering.", "INFO");
    printPlan(suitableObs);

    // Filter out observations that don't meet the required astronomical conditions (e.g., moon proximity, altitude).
    suitableObs = filterByAstronomy(suitableObs, moonCT, testing);
    // Log and print the list of requests after astronomy filtering.
    updateLog("Requests after astronomy filtering.", "INFO");
    printPlan(suitableObs);

    // Rank the remaining suitable observations based on priority, time, and astronomy scores.
    var rankedObs = rankObservations(suitableObs);
    // Log and print the list of requests after ranking.
    updateLog("Requests after ranking.", "INFO");
    printPlan(rankedObs);
    
    // Select the highest-ranked observation.
    var bestObs = selectTopObservation(rankedObs);
    return bestObs; // Return the best observation request.
}


// Select the top observation from the ranked list of requests.
// Returns the top request or "None" if the lsit is empty.
function selectTopObservation(requests) {
    if (requests.length == 0) {
        return "None"; // Return "None" if there are no valid observations.
    }
    return requests[0]; // Return the first (highest-ranked) request.
}

export { selectBestObservation };