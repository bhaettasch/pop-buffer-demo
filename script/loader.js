/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var loader = {};

/**
 * Base path for all loading operations
 */
loader.path = "data/";

/**
 * Load data
 */
loader.load = (function(fileName) {
    // load meta data json via ajax and parse
    var xmlhttp = new XMLHttpRequest();
    var url = loader.path+fileName;

    xmlhttp.onreadystatechange = function() {
        // once the meta data is loaded...
        if (this.readyState == 4 && this.status == 200) {
            // ...store data in a new global variable
            model = JSON.parse(this.responseText);

            // ...init drawing component
            drawer.init();
            drawer.vertexCount = model.numVertices;

            // ...and load vertices and normals
            loader.loadBinary(
                loader.path+model.data,
                function(arrayBuffer){
                    drawer.setData(arrayBuffer);
                },
                false
            );
        }
    };

    xmlhttp.open("GET", url, true);
    xmlhttp.send();
});

/**
 * Load binary data as arraybuffer and process with given method
 * 
 * @param url Url of the ressource to load
 * @param onload Method to be called with arraybuffer data after load
 */
loader.loadBinary = (function(url, onload, partial, begin, end, byteCount, itemSize) {
	//create request
	var oReq = new XMLHttpRequest();
	oReq.open("GET", url, true);

	oReq.responseType = "arraybuffer";
	
	// bind callback
	oReq.onload = function(oEvent) {
		// extract data...
 		var arrayBuffer = this.response;
        
 		// ...and process it
 		onload(arrayBuffer);
 	};

	// send
	oReq.send();
});
