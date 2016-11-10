/**
 * Drawer
 * 
 * Contains attributes and functions which are independent of the model type.
 */
Drawer = function() {};

/**
 * is the app ready for interaction (-> all data loaded)
 */
Drawer.prototype.ready = false;

/**
 * shader program
 */
Drawer.prototype.shaderProgram = {};

/**
 * model-view matrix, projection matrix, centering matrix, rotation matrix
 */
Drawer.prototype.mvMatrix = mat4.create();
Drawer.prototype.pMatrix = mat4.create();
Drawer.prototype.centerMatrix = mat4.create();
Drawer.prototype.rotationMatrix = mat4.create();

/**
 * UInt16 Array and buffer to hold the loaded data
 */
Drawer.prototype.interleavedArray = null;
Drawer.prototype.interleavedBuffer = null;


/**
 * camera aperture angle
 */
Drawer.prototype.alpha = 45;

/**
 * clipping plane distances
 */
Drawer.prototype.clipping = {near: 0, far: 0};

/**
 * initial distance camera <-> model, necessary for reset
 */
Drawer.prototype.initialZ = 0;

/**
 * current model position
 */
Drawer.prototype.currentX = 0;
Drawer.prototype.currentY = 0;
Drawer.prototype.currentZ = 0;

/**
 * maxmimum expansion
 */
Drawer.prototype.largeness = 0;

/**
 * Settings (can be adjusted via ui)
 */
Drawer.prototype.settings = {
	// Brightness
	ambientBrightness: 0.1,
	directionalBrightness: 0.8,
	// Speed and direction of animation
	animationSpeed: 0.4
};

/**
 * time of the last tick -- necessary for correct rotation at different framerates
 */
Drawer.prototype.lastTickTime = 0;

Drawer.prototype.vertexCount = 0;
Drawer.prototype.vertexCountCurrent = 0;

Drawer.prototype.model = null;
Drawer.prototype.currentLevel = 0;

/**
 * Initialization of Drawer
 */
Drawer.prototype.init = function(model) {
    this.model = model;

    // get triangle shaders
    this.initShaders("triangle-vs", "triangle-fs");

    // set canvas size to css values
    canvas.width = 	canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    gl.viewportWidth = canvas.offsetWidth;
    gl.viewportHeight = canvas.offsetHeight;

    // paint canvas white
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.DEPTH_TEST);

    // bind min and max values for decoding in shader
    gl.uniform3f(
        this.shaderProgram.minValuesUniform,
        model.xmin, model.ymin, model.zmin
    );
    gl.uniform3f(
        this.shaderProgram.maxValuesUniform,
        model.xmax, model.ymax, model.zmax
    );

    // create and bind array to hold the interleaved data
    this.interleavedArray = new Uint16Array(4 * model.numVertices);
    this.interleavedBuffer = this.initBuffer(4, model.numVertices);

    // zoom factors to make sure the model fits into the canvas exactly
    var w = Math.max(model.xmax-model.xmin, model.ymax-model.ymin);
    this.largeness = Math.max(w, model.zmax-model.zmin);
    var d = (w/2) / Math.tan(degToRad(this.alpha/2)) + (model.zmax-model.zmin)/2 + 0.2*w;
	this.initialZ = -d;
    this.currentZ = -d;
    
    // adapt clipping planes to model size
    this.clipping.near = 0.1 * this.largeness;
    this.clipping.far = -this.initialZ + this.largeness * 15;
    
    // init matrices
    this.initPerspective();
	mat4.identity(this.centerMatrix);
    mat4.translate(this.centerMatrix, [(model.xmin-model.xmax)/2 - model.xmin, (model.ymin-model.ymax)/2 - model.ymin, 0]);
    mat4.identity(this.mvMatrix);
    mat4.identity(this.rotationMatrix);

    // init lightning
    this.initLightning();

    // Animation/rotation
    this.lastTickTime = new Date().getTime();
    this.tick();
};

/**
 * Init shaders
 * Load shader program, combining both shaders (fragment and vertex shader)
 * 
 * @param vs String the vertex shader
 * @param fs String the fragment shader
 */
Drawer.prototype.initShaders = function(vs, fs) {
	
	//Get shaders
    var vertexShader = this.getShader(gl, vs);
    var fragmentShader = this.getShader(gl, fs);

    //Create program (attaching and linking)
    this.shaderProgram = gl.createProgram();
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);

    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
        console.log("Could not initialize shaders!");
    }

    //Activate program
    gl.useProgram(this.shaderProgram);

    //Save attributes of the shader as attributes of shader program (for easy access)
    this.shaderProgram.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
    
    this.shaderProgram.vertexNormalAttribute = gl.getAttribLocation(this.shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(this.shaderProgram.vertexNormalAttribute);

    //Set matrices
    this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
    this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
	this.shaderProgram.nMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uNMatrix");
	this.shaderProgram.ambientColorUniform = gl.getUniformLocation(this.shaderProgram, "uAmbientColor");
	this.shaderProgram.lightingDirectionUniform = gl.getUniformLocation(this.shaderProgram, "uLightingDirection");
    this.shaderProgram.directionalColorUniform = gl.getUniformLocation(this.shaderProgram, "uDirectionalColor");

    //Bind min and max values for decoding in shader
    this.shaderProgram.minValuesUniform = gl.getUniformLocation(this.shaderProgram, "uMinValues");
    this.shaderProgram.maxValuesUniform = gl.getUniformLocation(this.shaderProgram, "uMaxValues");
};

/**
 * Get a shader program
 * 
 * @param gl Context context
 * @param id String name of the shader
 * @returns the compiled shader or null if an error occurred
 */
Drawer.prototype.getShader = function(gl, id) {
    //Get dom object containing the program
	var shaderScript = document.getElementById(id);
    
    if (!shaderScript) {
        return null;
    }

    //Create string from content
    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    //Construct shader by type
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    //compile
    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
};

/**
 * Set perspective matrix (depends on the size of the canvas)
 * Has to be called every time canvas size changes
 */
Drawer.prototype.initPerspective = function() {
    mat4.perspective(this.alpha, gl.viewportWidth / gl.viewportHeight, this.clipping.near, this.clipping.far, this.pMatrix);
};

/**
 * Init buffer
 * 
 * @param itemSize numer of elements in array per item
 * @param numItems count of items in array
 * @returns the created and filled buffer
 */
Drawer.prototype.initBuffer = function(itemSize, numItems) {

	//Create and bind buffer
    var buffer = gl.createBuffer();
    //gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    
    buffer.itemSize = itemSize;
    buffer.numItems = numItems;
    
	return buffer;
};

/**
 * Append new data to an array
 * 
 * @param array Array to get appended
 * @param data Data to append
 * @param offset Starting item (part of offset index calculation)
 * @param itemSize Count of entries per item (part of offset index calculation)
 * 
 */
Drawer.prototype.arrayAppend = function(array, data, offset, itemSize) {
	array.set(data, offset * itemSize);
};

/**
 * Init lightning (also to be called if lightning changed)
 */
Drawer.prototype.initLightning = function() {
	//Copy ambient colors to shader programm
	gl.uniform3f(
		this.shaderProgram.ambientColorUniform,
		0.0, 0.2, 0.7
	);

	//Direction of light
	var lightingDirection = [0.0, 0.0, -1.0];
	var adjustedLD = vec3.create();

	vec3.normalize(lightingDirection, adjustedLD);
	vec3.scale(adjustedLD, -1);
	gl.uniform3fv(this.shaderProgram.lightingDirectionUniform, adjustedLD);

	//Copy directional colors to shader programm
	gl.uniform3f(
		this.shaderProgram.directionalColorUniform,
        0.0, 0.5, 0.0
	);
};

/**
 * Prepare drawing for subclasses draw call.
 */
Drawer.prototype.prepareDraw = function() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.identity(this.mvMatrix);
    
    mat4.translate(this.mvMatrix, [this.currentX, this.currentY, this.currentZ]);
    
    mat4.multiply(this.mvMatrix, this.rotationMatrix);
    
    mat4.multiply(this.mvMatrix, this.centerMatrix);

    this.setUniforms();
};

/**
 * Wrapper function for rotating the model around X axis
 *
 * @param deltaX float rotation difference in x-direction
 * @param deltaY float rotation difference in y-direction
 */
Drawer.prototype.rotate = function(deltaX, deltaY) {
    var newRotationMatrix = mat4.create();
    mat4.identity(newRotationMatrix);

    mat4.rotate(newRotationMatrix, degToRad(deltaX / 8), [0, 1, 0]);
    mat4.rotate(newRotationMatrix, degToRad(deltaY / 8), [1, 0, 0]);

    mat4.multiply(newRotationMatrix, this.rotationMatrix, this.rotationMatrix);

    this.draw();
};

/**
 * Repeated actions for every frame
 */
Drawer.prototype.tick = function() {

    //Activate this method again for next frame
    window.requestAnimFrame(drawer.tick);

    //Rotate and redraw frame
    var current = new Date().getTime();
    var elapsed = current - drawer.lastTickTime;

    drawer.lastTickTime = current;
    //Rotate (using elapsed time and speed factor)
    drawer.rotate(elapsed*drawer.settings.animationSpeed, 0);
};

/**
 * calculate uniforms and transfer them to GPU
 */
Drawer.prototype.setUniforms = function() {
    gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, this.pMatrix);
    gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, this.mvMatrix);
    
    gl.uniform1i(this.shaderProgram.useColor, (model.colors != undefined && model.colors != "false"));

	//Transform normals
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(this.mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(this.shaderProgram.nMatrixUniform, false, normalMatrix);
};

/**
 * Set vertex and normal data
 * Calls transformation and binds buffer
 *
 * @param interleavedData ArrayBuffer vertices New vertices data to fill buffer with
 * @param level level currently loaded
 */
Drawer.prototype.setData = function(interleavedData, level) {
    var offset = (level == 1) ? 0 : model.levels[level-2];
    var levelsize = (level == 1) ? model.levels[0] : (model.levels[level-1] - model.levels[level-2]);

    // Append data to buffer...
    this.interleavedArray.set(
        // Make sure the buffer only contains the data for this level
        interleavedData.subarray(0, levelsize * this.interleavedBuffer.itemSize),
        // Insert after the current data
        offset * this.interleavedBuffer.itemSize
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.interleavedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.interleavedArray, gl.STATIC_DRAW);

    gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, 3, gl.UNSIGNED_SHORT, false, 8, 0);
    gl.vertexAttribPointer(this.shaderProgram.vertexNormalAttribute, 2, gl.UNSIGNED_BYTE, false, 8, 6);

    // At least one chunk of data is loaded, thus the app can start drawing
    this.ready = true;

    this.vertexCountCurrent = offset + levelsize; //this.interleavedBuffer.numItems;
    ui.refreshVertexCount();
    this.draw();
}; 

/**
 * Draw the scene.
 *
 * @return bool false if drawing was not possible
 */
Drawer.prototype.draw = function() {
    //Don't try to draw before data is loaded
    if(!this.ready)
        return false;

    this.prepareDraw();
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCountCurrent);
};

Drawer.prototype.setLevel = function(level) {
    if(loader.currentLevel < level)
        this.currentLevel = loader.currentLevel;
    else
        this.currentLevel = level;

    this.vertexCountCurrent = model.levels[this.currentLevel-1];
    ui.refreshVertexCount();
    this.draw();
};
