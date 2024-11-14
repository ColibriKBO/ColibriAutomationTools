// Scheduling-related functions
// Converts a UTC time string to a Julian Date (JD) for astronomical calculations.
// JD is used for precision in tracking celestial events and scheduling observations.
function UTCtoJD(UTC) {
    // Split the UTC string into its components: year, month, day, hour, and minutes.
    var dividedUTC = UTC.split(":");

    // Parse the components as integers for calculation.
    var year = parseInt(dividedUTC[0], 10);
    var month = parseInt(dividedUTC[1], 10);
    var day = parseInt(dividedUTC[2], 10);
    var hour = parseInt(dividedUTC[3], 10);
    var minute = parseInt(dividedUTC[4], 10);

    // Convert the time into fractional hours and then fractional days.
    var fracHour = hour + (minute / 60); // Convert minutes to hours.
    var fracDay = day + (fracHour / 24); // Convert hours to a fractional part of the day.

    // Use the ACP Util Object to calculate the Julian Date from the year, month, and fractional day.
    var JD = Util.Calendar_Julian(year, month, fracDay);
    // Return the calculated Julian Date.
    return JD;
}

function JDtoUTC(JulianDate) {
	var millis = (JulianDate - 2440587.5) * 86400000;
	var toUTC = new Date(millis);
	
	var s = toUTC.getUTCFullYear();
	
	var month = (toUTC.getUTCMonth()+1).toString();
	var day   = (toUTC.getUTCDate()).toString();

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

// Calculates the altitude of the target based on its RA, DEC, and the Local Sidereal Time (LST).
function calculateAltitude(ra, dec, newLST) {
    var ct = Util.NewCT(Telescope.SiteLatitude, newLST); // Create a new coordinate transform (CT) object with the telescope's latitude and current LST.

    Console.PrintLine("Elevation before: " + ct.Elevation);
    ct.RightAscension = ra/15; // Convert Right Ascension from degrees to hours. Set the Right Ascension of the target.
    ct.Declination = dec; // Set the Declination of the target.
    Console.PrintLine("Elevation after: " + ct.Elevation);

    return ct.Elevation; // Return the target's altitude (elevation) in degrees.
}

// Calculates the angular distance between the target and the moon in degrees.
function calculateMoonAngle(ra, dec, moonCT) {
    var b = (90 - dec) * Math.PI / 180; // Convert Declination to radians.
    var c = (90 - moonCT.Declination) * Math.PI / 180; // Convert Moon Declination to radians.
    var aa = Math.abs(ra - moonCT.RightAscension) * Math.PI / 180; // Convert RA difference to radians.

    // Use the spherical law of cosines to calculate the angular distance between the target and the moon.
    var moonAngle = Math.acos((Math.cos(b) * Math.cos(c)) + (Math.sin(b) * Math.sin(c) * Math.cos(aa))) * 180 / Math.PI;
    return moonAngle; // Return the moon angle in degrees.
}



// Export the functions for use in other scripts.
export { UTCtoJD, calculateAltitude, calculateMoonAngle, JDtoUTC };