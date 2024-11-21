
function runTests() {
    var tests = [
        // Typical case
        { input: "2024-11-20T15:30:00Z", expected: "2024-11-21T15:30:00Z" },

        // End of month (30-day month)
        { input: "2024-11-30T15:30:00Z", expected: "2024-12-01T15:30:00Z" },

        // End of month (31-day month)
        { input: "2024-12-31T15:30:00Z", expected: "2025-01-01T15:30:00Z" },

        // Leap year (February 29th)
        { input: "2024-02-28T15:30:00Z", expected: "2024-02-29T15:30:00Z" },

        // Non-leap year (February 28th)
        { input: "2023-02-28T15:30:00Z", expected: "2023-03-01T15:30:00Z" },

        // New Year transition
        { input: "2023-12-31T23:59:59Z", expected: "2024-01-01T23:59:59Z" },

        // Middle of month
        { input: "2024-01-15T10:00:00Z", expected: "2024-01-16T10:00:00Z" },

        // Invalid date format
        { input: "invalid-date", expected: "Error" }
    ];

    tests.forEach(function (test, index) {
        try {
            var result = updateDay(test.input);
            if (result === test.expected) {
                console.log("Test " + (index + 1) + " passed.");
            } else {
                console.log("Test " + (index + 1) + " failed: Expected " + test.expected + ", got " + result);
            }
        } catch (e) {
            if (test.expected === "Error") {
                console.log("Test " + (index + 1) + " passed (caught expected error).");
            } else {
                console.log("Test " + (index + 1) + " failed: Unexpected error.");
            }
        }
    });
}

runTests();

function updateDay(timeString) {
    // Parse the input time string into a Date object
    var date = new Date(timeString);

    if (isNaN(date)) {
        throw new Error("Invalid time string format.");
    }

    // Add one day
    date.setDate(date.getDate() + 1);

    // Convert back to ISO 8601 string and return
    return toISODateString(date)
}

function toISODateString(date) {
    function pad(number) {
        return number < 10 ? '0' + number : number;
    }

    var year = date.getUTCFullYear();
    var month = date.getUTCMonth();
    var utcdate = date.getUTCDate();
    var hours = date.getUTCHours();
    var mins = date.getUTCMinutes();
    var secs = date.getUTCSeconds();

    return year + '-' +
        pad(month + 1) + '-' +
        pad(utcdate) + 'T' +
        pad(hours) + ':' +
        pad(mins) + ':' +
        pad(secs) + 'Z';
}
