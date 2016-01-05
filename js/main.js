var webglet = require('webglet');
var mat4 = require('gl-matrix').mat4;

var VideoScroll = function(options) {
    webglet.App.call(this, options);

    this.shiftAmount = 10;
    this.frameCount = 0;

    this.video = options.video;
    this.boundOnVideoLoad = this.onVideoLoad.bind(this);
    this.video.addEventListener('loadeddata', this.boundOnVideoLoad);
};
VideoScroll.prototype = Object.create(webglet.App.prototype);
VideoScroll.prototype.constructor = VideoScroll;

VideoScroll.prototype.onVideoLoad = function() {
    if (this.video.videoWidth == 0 ||
        this.video.videoHeight == 0) {
        return;
    }
    this.video.removeEventListener('loadeddata', this.boundOnVideoLoad);

    // ===== Textures =====
    // Create the video texture
    this.videoTexture = new webglet.Texture(this.video.videoWidth,
                                            this.video.videoHeight);

    // ===== Renderers =====
    // Renders the video to a texture
    var vs = document.getElementById('texture-vert').textContent;
    var fs = document.getElementById('texture-frag').textContent;
    this.videoRenderer = new webglet.FramebufferRenderer(this.video.videoWidth,
                                                         this.video.videoHeight,
                                                         vs, fs);

    // Shifts the video down
    var vs = document.getElementById('shift-down-vert').textContent;
    var fs = document.getElementById('shift-down-frag').textContent;
    this.shiftRenderer = new webglet.FramebufferRenderer(this.video.videoWidth,
                                                         this.video.videoHeight,
                                                         vs, fs);
    var offset = this.shiftAmount / this.video.videoHeight;
    this.shiftRenderer.shaderProgram.setUniform('uOffset', offset);

    // Renders the output
    var vs = document.getElementById('output-vert').textContent;
    var fs = document.getElementById('output-frag').textContent;
    this.sphereRenderer = new webglet.BasicRenderer(vs, fs);

    // For debugging
    //var vs = document.getElementById('texture-vert').textContent;
    //var fs = document.getElementById('texture-frag').textContent;
    //this.debugRenderer = new webglet.BasicRenderer(vs, fs);


    // ===== Meshes =====
    // Draws the lines from the video
    this.lineMesh = new webglet.RectMesh(this.video.videoWidth, this.shiftAmount,
                                         gl.STATIC_DRAW, null, null,
                                         gl.STATIC_DRAW);
    this.lineMesh.texCoordBuffer.setValues([0, 0.5,
                                            0, 0.5 + offset,
                                            1, 0.5,
                                            1, 0.5 + offset]);

    // Used to shift the texture down
    this.texMesh = new webglet.RectMesh(this.video.videoWidth,
                                        this.video.videoHeight,
                                        gl.STATIC_DRAW, null, null,
                                        gl.STATIC_DRAW);
    // Sphere to draw onto
    var vertices = [];
    var normals = [];
    var texCoords = [];
    var thetaSteps = 50;
    var phiSteps = 100;
    for (var thetaStep=0; thetaStep<thetaSteps; thetaStep++) {
        var theta1 = thetaStep * Math.PI / thetaSteps;
        var theta2 = (thetaStep + 1) * Math.PI / thetaSteps;

        for (var phiStep=0; phiStep<phiSteps; phiStep++) {
            phi = phiStep * Math.PI * 2 / phiSteps;
            var x = Math.sin(theta1) * Math.cos(phi);
            var y = Math.sin(theta1) * Math.sin(phi);
            var z = Math.cos(theta1);

            normals.push(x, y, z);
            vertices.push(x, y, z);
            texCoords.push(Math.asin(x)/Math.PI + 0.5,
                           Math.asin(y)/Math.PI + 0.5);

            x = Math.sin(theta2) * Math.cos(phi);
            y = Math.sin(theta2) * Math.sin(phi);
            z = Math.cos(theta2);

            normals.push(x, y, z);
            vertices.push(x, y, z);
            texCoords.push(Math.asin(x)/Math.PI + 0.5,
                           Math.asin(y)/Math.PI + 0.5);
        }
    }
    this.sphereMesh = new webglet.Mesh(vertices.length/3, gl.TRIANGLE_STRIP,
                               gl.STATIC_DRAW, null,
                               gl.STATIC_DRAW, gl.STATIC_DRAW);
    this.sphereMesh.vertexBuffer.setValues(vertices);
    this.sphereMesh.normalBuffer.setValues(normals);
    this.sphereMesh.texCoordBuffer.setValues(texCoords);

    // ===== Matrices =====
    // Sphere drawing
    this.projectionMatrix = mat4.create();
    this.modelviewMatrix = mat4.create();
    mat4.lookAt(this.modelviewMatrix, [0, 0, 3.5],
                                      [0, 0, 0],
                                      [0, 1, 0]);
    this.sphereRenderer.setUniform('uModelviewMatrix',
                                   this.modelviewMatrix);

    this.normalMatrix = mat4.create();
    mat4.invert(this.normalMatrix, this.modelviewMatrix);
    mat4.transpose(this.normalMatrix, this.normalMatrix);
    this.sphereRenderer.setUniform('uNormalMatrix',
                                   this.normalMatrix);

    // 2D drawing
    this.orthoProjectionMatrix = mat4.create();
    mat4.ortho(this.orthoProjectionMatrix,
               0, this.video.videoWidth, this.video.videoHeight, 0, -1, 1);
    this.videoRenderer.setUniform('uProjectionMatrix',
                                  this.orthoProjectionMatrix);
    this.shiftRenderer.setUniform('uProjectionMatrix',
                                  this.orthoProjectionMatrix);
//    this.debugRenderer.setUniform('uProjectionMatrix',
//                                  this.orthoProjectionMatrix);

    this.orthoModelviewMatrix = mat4.create();
    mat4.identity(this.orthoModelviewMatrix);
    this.videoRenderer.setUniform('uModelviewMatrix',
                                  this.orthoModelviewMatrix);
    this.shiftRenderer.setUniform('uModelviewMatrix',
                                  this.orthoModelviewMatrix);
//    this.debugRenderer.setUniform('uModelviewMatrix',
//                                  this.orthoModelviewMatrix);
    window.requestAnimationFrame(this.draw.bind(this));
};

VideoScroll.prototype.draw = function() {
    window.requestAnimationFrame(this.draw.bind(this));
    if (this.video.paused ||
        !(this.video.readyState == this.video.HAVE_FUTURE_DATA ||
          this.video.readyState == this.video.HAVE_ENOUGH_DATA)) {
        return;
    }

    this.updateViewport();

    mat4.perspective(this.projectionMatrix, Math.PI / 4,
                     this.canvas.width/this.canvas.height,
                     0.1, 10000);
    this.sphereRenderer.setUniform('uProjectionMatrix',
                                   this.projectionMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update the video texture
    this.videoTexture.loadFromExisting(this.video);

    // Put lines from the video to the top of the framebuffer
    this.videoTexture.begin();
    this.videoRenderer.render(this.lineMesh);
    //this.debugRenderer.render(this.texMesh);
    this.videoTexture.end();

    this.videoRenderer.framebuffer.texture.begin();
    // Render to the sphere
    this.sphereRenderer.setUniform('uFrameCount', this.frameCount);
    this.sphereRenderer.render(this.sphereMesh);
    //this.debugRenderer.render(this.texMesh);

    // Shift down
    this.shiftRenderer.render(this.texMesh);
    this.videoRenderer.framebuffer.texture.end();

    // Flip-flop!
    var shiftFBTexture = this.shiftRenderer.framebuffer.texture;
    var videoFBTexture = this.videoRenderer.framebuffer.texture;

    this.videoRenderer.framebuffer.attachTexture(shiftFBTexture);
    this.shiftRenderer.framebuffer.attachTexture(videoFBTexture);

    this.frameCount += 1;
};

document.addEventListener('DOMContentLoaded', function() {
    var video = document.getElementById('video');
    video.muted = true;
    video.volume = 0;
    var canvas = document.getElementById('canvas');

    var app = new VideoScroll({
        video: video,
        canvas: canvas
    });
});
