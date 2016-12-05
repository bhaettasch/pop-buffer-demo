/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var loader = {};

/**
 * Base path for all loading operations
 */
loader.path = "data/";

loader.currentlyLoaded = 0;

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
            drawer.init(model);
            drawer.vertexCount = model.numVertices;

            ui.bindSlider(model.levelCount);

            // ...and load vertices and normals
            loader.loadLevel();
        }
    };

    xmlhttp.open("GET", url, true);
    xmlhttp.send();
});

/**
 * Load vertices and normals
 */
loader.loadLevel = function () {
    if(loader.currentlyLoaded < model.levelCount)
    {
        var begin = (loader.currentlyLoaded == 0) ? 0 : model.levels[loader.currentlyLoaded-1];
        var end = model.levels[loader.currentlyLoaded];
        var byteCount = 8;

        loader.loadBinary(
            loader.path+model.data,
            function(arrayBuffer){
                // Does the answer contain only the requested range of bytes?
                if(arrayBuffer.byteLength == (end-begin)*byteCount)
                {
                    loader.currentlyLoaded++;

                    // Add this data to the data to display...
                    drawer.setData(new Uint16Array(arrayBuffer), true, loader.currentlyLoaded);
                    // ...and load the next level
                    loader.loadLevel();
                }
                // Otherwise:
                else
                {
                    loader.currentlyLoaded = model.levelCount;
                    // Set all the data at once and finish loading
                    drawer.setData(new Uint16Array(arrayBuffer), false, -1);
                }
            },
            true,
            begin,
            end,
            byteCount
        );
    }
};

/**
 * Load binary data as arraybuffer and process with given method
 *
 * @param url Url of the ressource to load
 * @param onload Method to be called with arraybuffer data after load
 * @param partial Perform a partial request?
 * @param begin Index of the first item to load
 * @param end Index of the last item to load
 * @param byteCount Count of bytes to load per item
 */
loader.loadBinary = (function(url, onload, partial, begin, end, byteCount) {
	//create request
	var oReq = new XMLHttpRequest();
	oReq.open("GET", url, true);

    if(partial)
    {
        begin = begin * byteCount;
        end = (end * byteCount)-1;

        // Set partial load header
        oReq.setRequestHeader("Range","bytes="+begin+"-"+end)
    }

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
