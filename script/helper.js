/**
 * @class Helper
 * @description Contains several global helping functions
 */

/**
 * Simple degree to radian conversion function.
 */
function degToRad(degrees) 
{
    return degrees * Math.PI / 180;
}


/**
 * Sum up two arrays
 * Both have to be of the same size
 * 
 * @param any[] arr1 first array
 * @param any[] arr2 second array
 * @return any[] sum of the two arguments (component wise)
 */
function arrayAdd(arr1, arr2) {
	var r = new Array(arr1.length);
	
	for(var i=0;i<arr1.length;i++)
		r[i] = arr1[i] + arr2[i];
	
	return r;
}
