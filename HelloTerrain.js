
/**
 * @file A simple WebGL example drawing central Illinois style terrain
 * @author Eric Shaffer <shaffer1@illinois.edu>  
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global The angle of rotation around the y axis */
var viewRot = 10;

/** @global A glmatrix vector to use for transformations */
var transformVec = vec3.create();

// Initialize the vector....
vec3.set(transformVec,0.0,0.0,-2.0);

/** @global An object holding the geometry for a 3D terrain */
var myTerrain;

// Is the fog showing
var isFog = false;

// Amount to roll by
var rollAmnt = 0.01;

// Amount to pitch by
var pitchAmnt = 0.01;

// Amount to increase speed by
var speedAmnt = 0.0005;

// Current speed, roll, and pitch
var speed = 0.0005;
var roll = 0.0;
var pitch = 0.0;

// Array of pressed keys
var keysPressed = {};

// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,0.0,0.0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

var upRot = vec3.create();
var rotUp = quat.create();
var rotDir = vec3.fromValues(0.0,0.0,-0.5);
var viewer = quat.create();
var rotRoll = quat.create();
var rotPit = quat.create();

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [20,20,3];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1,1,1];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.0,0.0, 0.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;



//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform,
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
    return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");
  shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKDiffuse");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");
  shaderProgram.foggy = gl.getUniformLocation(shaderProgram, "fogOn");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 * @param {booleab} hasFog Specular material color
 */
function setMaterialUniforms(alpha,a,d,s,hasFog) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
  gl.uniform1f(shaderProgram.foggy, hasFog);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {
    myTerrain = new Terrain(100,-0.5,0.5,-0.5,0.5);
    myTerrain.loadBuffers();
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {
    eyePt[2] += rotDir[2] * speed;
    eyePt[1] += rotDir[1] * speed;
    eyePt[0] += rotDir[0] * speed;

    rollAndPitch();
    var transformVec = vec3.create();

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(45),
                     gl.viewportWidth / gl.viewportHeight,
                     0.1, 200.0);

    // We want to look down -z, so create a lookat point in that direction
    vec3.add(viewPt, eyePt, rotDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,upRot);

    //Draw Terrain
    mvPushMatrix();
    vec3.set(transformVec,0.0,-0.25,-2.0);
    mat4.translate(mvMatrix, mvMatrix,transformVec);
    mat4.rotateY(mvMatrix, mvMatrix, degToRad(viewRot));
    mat4.rotateX(mvMatrix, mvMatrix, degToRad(-75));
    setMatrixUniforms();
    setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);

    if (document.getElementById("toFog").checked) {
      isFog = true;
    } else {
      isFog = false;
    }

    setMaterialUniforms(shininess,kAmbient,kTerrainDiffuse,kSpecular, isFog);
    myTerrain.drawTriangles();

    mvPopMatrix();
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  tick();
}

//----------------------------------------------------------------------------------
/**
 * Handle key presses
 */

function keyReleased(event) {
    keysPressed[event.keyCode] = false;
}

function keyPressed(event) {
    keysPressed[event.keyCode] = true;
}

//----------------------------------------------------------------------------------
/**
 * Animate function
 */
function animate() {
    if (keysPressed[187]) {
        speed += speedAmnt;
    } else if (keysPressed[189]) {
        speed -= speedAmnt;
    }

    if (keysPressed[39]) {
        roll += rollAmnt;
    } else if (keysPressed[37]) {
        roll -= rollAmnt;
    } else if (keysPressed[38]) {
        pitch += pitchAmnt;
    } else if (keysPressed[40]) {
        pitch -= pitchAmnt;
    }
}


//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames....
 */
function tick() {
    document.onkeydown = keyPressed;
    document.onkeyup = keyReleased;
    requestAnimFrame(tick);
    animate();
    draw();
}

/**
 * Rotation around z and x axis
 */
function rollAndPitch() {
    var temp1 = vec3.cross(vec3.create(), viewDir, upRot);
    rotRoll[3] = Math.cos(roll / 2);
    rotPit[3] = Math.cos(pitch / 2);
    rotRoll[2] = viewDir[2] * Math.sin(roll / 2);
    rotPit[2] = temp1[2] * Math.sin(pitch / 2);
    rotRoll[1] = viewDir[1] * Math.sin(roll / 2);
    rotPit[1] = temp1[1] * Math.sin(pitch / 2);
    rotRoll[0] = viewDir[0] * Math.sin(roll / 2);
    rotPit[0] = temp1[0] * Math.sin(pitch / 2);
    rotUp = quat.multiply(rotUp, rotRoll, quat.fromValues(up[0], up[1], up[2], 0));
    rotUp = quat.multiply(rotUp, rotUp, rotPit);
    upRot = vec3.fromValues(rotUp[0], rotUp[1], rotUp[2]);
    viewer = quat.multiply(viewer, rotPit, quat.fromValues(viewDir[0], viewDir[1], viewDir[2], 0));
    viewer = quat.multiply(viewer, viewer, rotRoll);
    rotUp = quat.multiply(rotUp, quat.multiply(rotUp, rotPit, quat.fromValues(upRot[0], upRot[1], upRot[2], 0)), quat.conjugate(rotPit, rotRoll));
    upRot = vec3.fromValues(rotUp[0], rotUp[1], rotUp[2]);
    rotDir = vec3.fromValues(viewer[0], viewer[1], viewer[2]);
}
