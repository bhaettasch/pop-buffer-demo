/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var loader = {};

/**
 * Synchronize ajax requests (max. 10)
 */
loader.loadingQueue = 0;

loader.requestProgress = Array();

/**
 * Base path for all loading operations
 */
loader.path = "data/";

loader.tmp = {
	vertices : null,
	normals: null
};

/**
 * Load data
 */
loader.load = (function() {

	model = {
		"name": "bunny_t",
		"numVertices": 208353,
		"verticesPerFace": 3,
		"xmin": -0.495867,
		"xmax": 0.319489,
		"ymin": 0.172747,
		"ymax": 0.980953,
		"zmin": -0.324017,
		"zmax": 0.307919,
		"vertices": "bunny_t.ver",
		"normals": "bunny_t.nor"
	};

	// init with usk data
	drawer.init();

	// load vertices and normals
	loader.loadSingleRequest();
});


/**
 * Load vertices and normals partial (for a given level)
 * 
 * @param level ID of the current data level
 */
loader.loadPartial = function(level) {
    loader.loadingQueue += 2;
    
    var begin = (level == 0) ? 0 : model.levelsizes[level-1];
    var end = model.levelsizes[level];
    
    // load vertices
    loader.loadBinary(
    		loader.path+model.vertices, 
    		function(arrayBuffer){loader.tmp.vertices = arrayBuffer;}, 
    		40, 
    		true,
    		begin, 
    		end, 
    		2, 
    		3
    	);
    
    // load normals
    loader.loadBinary(
    		loader.path+model.normals, 
    		function(arrayBuffer){loader.tmp.normals = arrayBuffer;}, 
    		40, 
    		true,
    		begin, 
    		end, 
    		2, 
    		3
    	);
};


/**
 * Load vertices and normals with a single request
 * 
 * @param ID of the current data level
 */
loader.loadSingleRequest = function() {
    loader.loadingQueue += 2;
    
    // load vertices
    loader.loadBinary(
    		loader.path+model.vertices, 
    		function(arrayBuffer){loader.tmp.vertices = arrayBuffer;}, 
    		40, 
    		false
    	);
    
    // load normals
    loader.loadBinary(
    		loader.path+model.normals, 
    		function(arrayBuffer){loader.tmp.normals = arrayBuffer;}, 
    		40, 
    		false
    	);
};


/**
 * Load binary data as arraybuffer and process with given method
 * 
 * @param url Url of the ressource to load
 * @param onload Method to be called with arraybuffer data after load
 * @param amount how much data (relative to 100%) has to be loaded for this request
 */
loader.loadBinary = (function(url, onload, amount, partial, begin, end, byteCount, itemSize) {

	//Create request
	var oReq = new XMLHttpRequest();
	oReq.open("GET", url, true);
	
	// Set everything for partial request
	if(partial)
	{
		begin = begin * itemSize * byteCount;
		end = (end * itemSize * byteCount)-1;
		
		// amount (for progress bar) depends on number of bytes
		var total = model.numVertices * itemSize * byteCount;
		amount = amount * ( (end-begin) / total );
		
		// Set partial load header
		oReq.setRequestHeader("Range","bytes="+begin+"-"+end)
	}
	oReq.responseType = "arraybuffer";	

	
	//Create new cell in progress array with starting value 0 and save index
	var requestId = this.requestProgress.push(0)-1;
	
	//Bind callback
	oReq.onload = function(oEvent) {
		//Extract data...
 		var arrayBuffer = oReq.response;
 		
 		//...process it...
 		onload(arrayBuffer);
 		
 		//...and call after loading method
 		loader.afterLoad();
 	};
 	
 	oReq.addEventListener("progress", function(oEvent) {
 		var newProgress = oEvent.loaded / oEvent.total;
 		
 		loader.requestProgress[requestId] = newProgress;
 	}, false);
	
	//Send
	oReq.send();
});


/**
 * Method to be called after every loading operation is finished
 * Will start drawing after all necessary data is loaded
 */
loader.afterLoad = (function() {
	this.loadingQueue--;
	
	// Every time the loading queue is empty
	if(this.loadingQueue==0)
	{

        // Set temporary vertex and normal data
        var nextLevel = drawer.setData(loader.tmp.vertices, loader.tmp.normals, loader.tmp.colors);
		
        // Load next level if neccessary
        if(nextLevel > -1)
            loader.loadPartial(nextLevel);
	}
});