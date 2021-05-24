/**
 * @fileoverview Terrain - A simple 3D terrain using WebGL
 * @author Eric Shaffer
 */

/** Class implementing 3D terrain. */
class Terrain{
    /**
     * Initialize members of a Terrain object
     * @param {number} div Number of triangles along x axis and y axis
     * @param {number} minX Minimum X coordinate value
     * @param {number} maxX Maximum X coordinate value
     * @param {number} minY Minimum Y coordinate value
     * @param {number} maxY Maximum Y coordinate value
     */
        constructor(div,minX,maxX,minY,maxY) {
            this.div = div;
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
    
            // Allocate vertex array
            this.vBuffer = [];
            // Allocate triangle array
            this.fBuffer = [];
            // Allocate normal array
            this.nBuffer = [];
            // Allocate array for edges so we can draw wireframe
            this.eBuffer = [];
            // Allocate array for colors
            this.cBuffer = [];
            console.log("Terrain: Allocated buffers");
    
            this.generateTriangles();
            console.log("Terrain: Generated triangles");
    
            this.generateLines();
            console.log("Terrain: Generated lines");
    
            this.adjustTerrain();

            this.generateColors();
    
            this.createNorm();

            // Get extension for 4 byte integer indices for drwElements
            var ext = gl.getExtension('OES_element_index_uint');
            if (ext ==null){
                alert("OES_element_index_uint is unsupported by your browser and terrain generation cannot proceed.");
            }
        }
    
        /**
        * Set the x,y,z coords of a vertex at location(i,j)
        * @param {Object} v an an array of length 3 holding x,y,z coordinates
        * @param {number} i the ith row of vertices
        * @param {number} j the jth column of vertices
        */
        setVertex(v,i,j) {
            var vid = 3 * (i * (this.div + 1) + j);
            this.vBuffer[vid + 0] = v[0];
            this.vBuffer[vid + 1] = v[1];
            this.vBuffer[vid + 2] = v[2];
        }
    
        /**
        * Return the x,y,z coordinates of a vertex at location (i,j)
        * @param {Object} v an array of length 3 holding x,y,z coordinates
        * @param {number} i the ith row of vertices
        * @param {number} j the jth column of vertices
        */
        getVertex(v,i,j) {
            var vid = 3 * (i * (this.div + 1) + j);
            v[0] = this.vBuffer[vid];
            v[1] = this.vBuffer[vid + 1];
            v[2] = this.vBuffer[vid + 2];
        }


    
        /**
        * Send the buffer objects to WebGL for rendering
        */
        loadBuffers() {
            // Specify the vertex coordinates
            this.VertexPositionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vBuffer), gl.STATIC_DRAW);
            this.VertexPositionBuffer.itemSize = 3;
            this.VertexPositionBuffer.numItems = this.numVertices;
            console.log("Loaded ", this.VertexPositionBuffer.numItems, " vertices");
    
            // Specify normals to be able to do lighting calculations
            this.VertexNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nBuffer),
                      gl.STATIC_DRAW);
            this.VertexNormalBuffer.itemSize = 3;
            this.VertexNormalBuffer.numItems = this.numVertices;
            console.log("Loaded ", this.VertexNormalBuffer.numItems, " normals");
    
            // Specify faces of the terrain
            this.IndexTriBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.fBuffer),
                      gl.STATIC_DRAW);
            this.IndexTriBuffer.itemSize = 1;
            this.IndexTriBuffer.numItems = this.fBuffer.length;
            console.log("Loaded ", this.IndexTriBuffer.numItems, " triangles");
    
            //Setup Edges
            this.IndexEdgeBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.eBuffer),
                      gl.STATIC_DRAW);
            this.IndexEdgeBuffer.itemSize = 1;
            this.IndexEdgeBuffer.numItems = this.eBuffer.length;
            console.log("triangulatedPlane: loadBuffers");
        }
    
        /**
        * Render the triangles
        */
        drawTriangles() {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                             gl.FLOAT, false, 0, 0);
    
            // Bind normal buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                               this.VertexNormalBuffer.itemSize,
                               gl.FLOAT, false, 0, 0);
    
            //Draw
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
            gl.drawElements(gl.TRIANGLES, this.IndexTriBuffer.numItems, gl.UNSIGNED_INT,0);
        }
    
        /**
        * Render the triangle edges wireframe style
        */
        drawEdges() {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                             gl.FLOAT, false, 0, 0);
    
            // Bind normal buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                               this.VertexNormalBuffer.itemSize,
                               gl.FLOAT, false, 0, 0);
    
            //Draw
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
            gl.drawElements(gl.LINES, this.IndexEdgeBuffer.numItems, gl.UNSIGNED_INT,0);
        }
    
        /**
         * Fill the vertex and buffer arrays
         */
        generateTriangles() {
            var deltaX = (this.maxX - this.minX) / this.div;
            var deltaY = (this.maxY - this.minY) / this.div;
    
            for (var i = 0; i <= this.div; i++) {
                for (var j = 0; j <= this.div; j++) {
                    this.vBuffer.push(this.minX + deltaX * j);
                    this.vBuffer.push(this.minY + deltaY * i);
                    this.vBuffer.push(0);
    
                    this.nBuffer.push(0);
                    this.nBuffer.push(0);
                    this.nBuffer.push(1);
                }
            }
    
            for (var i = 0; i < this.div; i++) {
                for (var j = 0; j < this.div; j++) {
                    var vid = i * (this.div + 1) + j;
                    this.fBuffer.push(vid);
                    this.fBuffer.push(vid + 1);
                    this.fBuffer.push(vid + this.div + 1);
    
                    this.fBuffer.push(vid + 1);
                    this.fBuffer.push(vid + 1 + this.div + 1);
                    this.fBuffer.push(vid + this.div + 1);
                }
            }
    
            this.numVertices = this.vBuffer.length/3;
            this.numFaces = this.fBuffer.length/3;
        }

        /**
         * Fill the color arrays.
         */
        generateColors() {
            for (var i = 0; i < this.div; i++) {
                for (var j = 0; j < this.div; j++) {
                    var vert = [];
                    this.getVertex(vert, i, j);
                    var color = 55;

                    for (var k = 0; k < 2; k++) {
                        if (k % 2 == 0) {
                            this.cBuffer.push(color);
                        } else {
                            this.cBuffer.push(0);
                        }
                    }
                }
            }
        }
    
        /**
         * Print vertices and triangles to console for debugging
         */
        printBuffers() {
            for (var i = 0; i < this.numVertices; i++) {
                   console.log("v ", this.vBuffer[i*3], " ",
                                     this.vBuffer[i*3 + 1], " ",
                                     this.vBuffer[i*3 + 2], " ");
            }
    
            for(var i = 0; i < this.numFaces; i++) {
                   console.log("f ", this.fBuffer[i*3], " ",
                                     this.fBuffer[i*3 + 1], " ",
                                     this.fBuffer[i*3 + 2], " ");
            }
        }
    
        /**
         * Generates line values from faces in faceArray
         * to enable wireframe rendering
         */
        generateLines() {
            var numTris=this.fBuffer.length/3;
            for(var f=0;f<numTris;f++)
            {
                var fid=f*3;
                this.eBuffer.push(this.fBuffer[fid]);
                this.eBuffer.push(this.fBuffer[fid+1]);
    
                this.eBuffer.push(this.fBuffer[fid+1]);
                this.eBuffer.push(this.fBuffer[fid+2]);
    
                this.eBuffer.push(this.fBuffer[fid+2]);
                this.eBuffer.push(this.fBuffer[fid]);
            }
        }
    
        /**
         * Create the normals to be used in the terrain and rendering.
         */
        createNorm() {
            for (var i = 0; i < this.fBuffer.length; i += 3) {
                var point1 = this.fBuffer[i];
                var point2 = this.fBuffer[i + 1];
                var point3 = this.fBuffer[i + 2];
                var point4 = this.nBuffer[i];
                var point5 = this.nBuffer[i + 1];
                var point6 = this.nBuffer[i + 2];
                var vector1 = vec3.create();
                vec3.set(vector1, this.vBuffer[point1 * 3], this.vBuffer[point1 * 3 + 1], this.vBuffer[point1 * 3 + 2]);
                var vector2 = vec3.create();
                vec3.set(vector2, this.vBuffer[point2 * 3], this.vBuffer[point2 * 3 + 1], this.vBuffer[point2 * 3 + 2]);
                var vector3 = vec3.create();
                vec3.set(vector3, this.vBuffer[point3 * 3], this.vBuffer[point3 * 3 + 1], this.vBuffer[point3 * 3 + 2]);
                var vector4 = vec3.create();
                vec3.set(vector4, point4, point5, point6);
                vec3.subtract(vector3, vector3, vector1);
                vec3.subtract(vector2, vector2, vector1);
                var norm = vec3.create();
                vec3.cross(norm, vector2, vector3);
                vec3.normalize(norm, norm);
                vec3.normalize(vector4, vector4);
                this.nBuffer[point1 * 3] += norm[0];
                this.nBuffer[point1 * 3 + 1] += norm[1];
                this.nBuffer[point1 * 3 + 2] += norm[2];
                this.nBuffer[point2 * 3] += norm[0];
                this.nBuffer[point2 * 3 + 1] += norm[1];
                this.nBuffer[point2 * 3 + 2] += norm[2];
                this.nBuffer[point3 * 3] += norm[0];
                this.nBuffer[point3 * 3 + 1] += norm[1];
                this.nBuffer[point3 * 3 + 2] += norm[2];
                this.nBuffer[i] = vector4[0];
                this.nBuffer[i + 1] = vector4[1];
                this.nBuffer[i + 2] = vector4[2];
            }
        }
    
        /**
         * Make the slices randomly and adjust the heights on each side of them accordignly.
         */
        adjustTerrain() {
            var disp = 0.007;

            for (var i = 0; i < 125; i++) {
                var sin1 = Math.sin(2.0 * Math.PI * Math.random());
                var cos1 = Math.cos(2.0 * Math.PI * Math.random());
                var x = Math.floor(Math.random() * this.div);
                var y = Math.floor(Math.random() * this.div);
    
                for (var j = 0; j < this.div + 1; j++) {
                    for (var k = 0; k < this.div + 1; k++) {
                        var dotProd = ((j - x) * cos1) + ((k - y) * sin1);
    
                        var vertex1 = [];
                        this.getVertex(vertex1, j, k);
                        var multiplier = 1;
                        
                        if (dotProd <= 0) {
                            multiplier = -1;
                        }

                        vertex1[2] += disp * multiplier;

                        this.setVertex(vertex1, j, k);
                    }
                }
            }
        }
    }
