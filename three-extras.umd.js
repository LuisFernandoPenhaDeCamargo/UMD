(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three')) :
	typeof define === 'function' && define.amd ? define(['three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ThreeExtras = factory(global.THREE));
})(this, (function (three) { 'use strict';

	/**
	 * A loader for loading fonts.
	 *
	 * You can convert fonts online using [facetype.js]{@link https://gero3.github.io/facetype.js/}.
	 *
	 * ```js
	 * const loader = new FontLoader();
	 * const font = await loader.loadAsync( 'fonts/helvetiker_regular.typeface.json' );
	 * ```
	 *
	 * @augments Loader
	 * @three_import import { FontLoader } from 'three/addons/loaders/FontLoader.js';
	 */
	class FontLoader extends three.Loader {

		/**
		 * Constructs a new font loader.
		 *
		 * @param {LoadingManager} [manager] - The loading manager.
		 */
		constructor( manager ) {

			super( manager );

		}

		/**
		 * Starts loading from the given URL and passes the loaded font
		 * to the `onLoad()` callback.
		 *
		 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
		 * @param {function(Font)} onLoad - Executed when the loading process has been finished.
		 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
		 * @param {onErrorCallback} onError - Executed when errors occur.
		 */
		load( url, onLoad, onProgress, onError ) {

			const scope = this;

			const loader = new three.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				const font = scope.parse( JSON.parse( text ) );

				if ( onLoad ) onLoad( font );

			}, onProgress, onError );

		}

		/**
		 * Parses the given font data and returns the resulting font.
		 *
		 * @param {Object} json - The raw font data as a JSON object.
		 * @return {Font} The font.
		 */
		parse( json ) {

			return new Font( json );

		}

	}

	/**
	 * Class representing a font.
	 */
	class Font {

		/**
		 * Constructs a new font.
		 *
		 * @param {Object} data - The font data as JSON.
		 */
		constructor( data ) {

			/**
			 * This flag can be used for type testing.
			 *
			 * @type {boolean}
			 * @readonly
			 * @default true
			 */
			this.isFont = true;

			this.type = 'Font';

			/**
			 * The font data as JSON.
			 *
			 * @type {Object}
			 */
			this.data = data;

		}

		/**
		 * Generates geometry shapes from the given text and size. The result of this method
		 * should be used with {@link ShapeGeometry} to generate the actual geometry data.
		 *
		 * @param {string} text - The text.
		 * @param {number} [size=100] - The text size.
		 * @return {Array<Shape>} An array of shapes representing the text.
		 */
		generateShapes( text, size = 100 ) {

			const shapes = [];
			const paths = createPaths( text, size, this.data );

			for ( let p = 0, pl = paths.length; p < pl; p ++ ) {

				shapes.push( ...paths[ p ].toShapes() );

			}

			return shapes;

		}

	}

	function createPaths( text, size, data ) {

		const chars = Array.from( text );
		const scale = size / data.resolution;
		const line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;

		const paths = [];

		let offsetX = 0, offsetY = 0;

		for ( let i = 0; i < chars.length; i ++ ) {

			const char = chars[ i ];

			if ( char === '\n' ) {

				offsetX = 0;
				offsetY -= line_height;

			} else {

				const ret = createPath( char, scale, offsetX, offsetY, data );
				offsetX += ret.offsetX;
				paths.push( ret.path );

			}

		}

		return paths;

	}

	function createPath( char, scale, offsetX, offsetY, data ) {

		const glyph = data.glyphs[ char ] || data.glyphs[ '?' ];

		if ( ! glyph ) {

			console.error( 'THREE.Font: character "' + char + '" does not exists in font family ' + data.familyName + '.' );

			return;

		}

		const path = new three.ShapePath();

		let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

		if ( glyph.o ) {

			const outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

			for ( let i = 0, l = outline.length; i < l; ) {

				const action = outline[ i ++ ];

				switch ( action ) {

					case 'm': // moveTo

						x = outline[ i ++ ] * scale + offsetX;
						y = outline[ i ++ ] * scale + offsetY;

						path.moveTo( x, y );

						break;

					case 'l': // lineTo

						x = outline[ i ++ ] * scale + offsetX;
						y = outline[ i ++ ] * scale + offsetY;

						path.lineTo( x, y );

						break;

					case 'q': // quadraticCurveTo

						cpx = outline[ i ++ ] * scale + offsetX;
						cpy = outline[ i ++ ] * scale + offsetY;
						cpx1 = outline[ i ++ ] * scale + offsetX;
						cpy1 = outline[ i ++ ] * scale + offsetY;

						path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );

						break;

					case 'b': // bezierCurveTo

						cpx = outline[ i ++ ] * scale + offsetX;
						cpy = outline[ i ++ ] * scale + offsetY;
						cpx1 = outline[ i ++ ] * scale + offsetX;
						cpy1 = outline[ i ++ ] * scale + offsetY;
						cpx2 = outline[ i ++ ] * scale + offsetX;
						cpy2 = outline[ i ++ ] * scale + offsetY;

						path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );

						break;

				}

			}

		}

		return { offsetX: glyph.ha * scale, path: path };

	}

	/**
	 * A class for generating text as a single geometry. It is constructed by providing a string of text, and a set of
	 * parameters consisting of a loaded font and extrude settings.
	 *
	 * See the {@link FontLoader} page for additional details.
	 *
	 * `TextGeometry` uses [typeface.json]{@link http://gero3.github.io/facetype.js/} generated fonts.
	 * Some existing fonts can be found located in `/examples/fonts`.
	 *
	 * ```js
	 * const loader = new FontLoader();
	 * const font = await loader.loadAsync( 'fonts/helvetiker_regular.typeface.json' );
	 * const geometry = new TextGeometry( 'Hello three.js!', {
	 * 	font: font,
	 * 	size: 80,
	 * 	depth: 5,
	 * 	curveSegments: 12
	 * } );
	 * ```
	 *
	 * @augments ExtrudeGeometry
	 * @three_import import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
	 */
	class TextGeometry extends three.ExtrudeGeometry {

		/**
		 * Constructs a new text geometry.
		 *
		 * @param {string} text - The text that should be transformed into a geometry.
		 * @param {TextGeometry~Options} [parameters] - The text settings.
		 */
		constructor( text, parameters = {} ) {

			const font = parameters.font;

			if ( font === undefined ) {

				super(); // generate default extrude geometry

			} else {

				const shapes = font.generateShapes( text, parameters.size );

				// defaults

				if ( parameters.depth === undefined ) parameters.depth = 50;
				if ( parameters.bevelThickness === undefined ) parameters.bevelThickness = 10;
				if ( parameters.bevelSize === undefined ) parameters.bevelSize = 8;
				if ( parameters.bevelEnabled === undefined ) parameters.bevelEnabled = false;

				super( shapes, parameters );

			}

			this.type = 'TextGeometry';

		}

	}

	/**
	 * Fires when the camera has been transformed by the controls.
	 *
	 * @event OrbitControls#change
	 * @type {Object}
	 */
	const _changeEvent = { type: 'change' };

	/**
	 * Fires when an interaction was initiated.
	 *
	 * @event OrbitControls#start
	 * @type {Object}
	 */
	const _startEvent = { type: 'start' };

	/**
	 * Fires when an interaction has finished.
	 *
	 * @event OrbitControls#end
	 * @type {Object}
	 */
	const _endEvent = { type: 'end' };

	const _ray = new three.Ray();
	const _plane$1 = new three.Plane();
	const _TILT_LIMIT = Math.cos( 70 * three.MathUtils.DEG2RAD );

	const _v = new three.Vector3();
	const _twoPI = 2 * Math.PI;

	const _STATE = {
		NONE: -1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6
	};
	const _EPS = 0.000001;


	/**
	 * Orbit controls allow the camera to orbit around a target.
	 *
	 * OrbitControls performs orbiting, dollying (zooming), and panning. Unlike {@link TrackballControls},
	 * it maintains the "up" direction `object.up` (+Y by default).
	 *
	 * - Orbit: Left mouse / touch: one-finger move.
	 * - Zoom: Middle mouse, or mousewheel / touch: two-finger spread or squish.
	 * - Pan: Right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move.
	 *
	 * ```js
	 * const controls = new OrbitControls( camera, renderer.domElement );
	 *
	 * // controls.update() must be called after any manual changes to the camera's transform
	 * camera.position.set( 0, 20, 100 );
	 * controls.update();
	 *
	 * function animate() {
	 *
	 * 	// required if controls.enableDamping or controls.autoRotate are set to true
	 * 	controls.update();
	 *
	 * 	renderer.render( scene, camera );
	 *
	 * }
	 * ```
	 *
	 * @augments Controls
	 * @three_import import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	 */
	class OrbitControls extends three.Controls {

		/**
		 * Constructs a new controls instance.
		 *
		 * @param {Object3D} object - The object that is managed by the controls.
		 * @param {?HTMLDOMElement} domElement - The HTML element used for event listeners.
		 */
		constructor( object, domElement = null ) {

			super( object, domElement );

			this.state = _STATE.NONE;

			/**
			 * The focus point of the controls, the `object` orbits around this.
			 * It can be updated manually at any point to change the focus of the controls.
			 *
			 * @type {Vector3}
			 */
			this.target = new three.Vector3();

			/**
			 * The focus point of the `minTargetRadius` and `maxTargetRadius` limits.
			 * It can be updated manually at any point to change the center of interest
			 * for the `target`.
			 *
			 * @type {Vector3}
			 */
			this.cursor = new three.Vector3();

			/**
			 * How far you can dolly in (perspective camera only).
			 *
			 * @type {number}
			 * @default 0
			 */
			this.minDistance = 0;

			/**
			 * How far you can dolly out (perspective camera only).
			 *
			 * @type {number}
			 * @default Infinity
			 */
			this.maxDistance = Infinity;

			/**
			 * How far you can zoom in (orthographic camera only).
			 *
			 * @type {number}
			 * @default 0
			 */
			this.minZoom = 0;

			/**
			 * How far you can zoom out (orthographic camera only).
			 *
			 * @type {number}
			 * @default Infinity
			 */
			this.maxZoom = Infinity;

			/**
			 * How close you can get the target to the 3D `cursor`.
			 *
			 * @type {number}
			 * @default 0
			 */
			this.minTargetRadius = 0;

			/**
			 * How far you can move the target from the 3D `cursor`.
			 *
			 * @type {number}
			 * @default Infinity
			 */
			this.maxTargetRadius = Infinity;

			/**
			 * How far you can orbit vertically, lower limit. Range is `[0, Math.PI]` radians.
			 *
			 * @type {number}
			 * @default 0
			 */
			this.minPolarAngle = 0;

			/**
			 * How far you can orbit vertically, upper limit. Range is `[0, Math.PI]` radians.
			 *
			 * @type {number}
			 * @default Math.PI
			 */
			this.maxPolarAngle = Math.PI;

			/**
			 * How far you can orbit horizontally, lower limit. If set, the interval `[ min, max ]`
			 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
			 *
			 * @type {number}
			 * @default -Infinity
			 */
			this.minAzimuthAngle = - Infinity;

			/**
			 * How far you can orbit horizontally, upper limit. If set, the interval `[ min, max ]`
			 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
			 *
			 * @type {number}
			 * @default -Infinity
			 */
			this.maxAzimuthAngle = Infinity;

			/**
			 * Set to `true` to enable damping (inertia), which can be used to give a sense of weight
			 * to the controls. Note that if this is enabled, you must call `update()` in your animation
			 * loop.
			 *
			 * @type {boolean}
			 * @default false
			 */
			this.enableDamping = false;

			/**
			 * The damping inertia used if `enableDamping` is set to `true`.
			 *
			 * Note that for this to work, you must call `update()` in your animation loop.
			 *
			 * @type {number}
			 * @default 0.05
			 */
			this.dampingFactor = 0.05;

			/**
			 * Enable or disable zooming (dollying) of the camera.
			 *
			 * @type {boolean}
			 * @default true
			 */
			this.enableZoom = true;

			/**
			 * Speed of zooming / dollying.
			 *
			 * @type {number}
			 * @default 1
			 */
			this.zoomSpeed = 1.0;

			/**
			 * Enable or disable horizontal and vertical rotation of the camera.
			 *
			 * Note that it is possible to disable a single axis by setting the min and max of the
			 * `minPolarAngle` or `minAzimuthAngle` to the same value, which will cause the vertical
			 * or horizontal rotation to be fixed at that value.
			 *
			 * @type {boolean}
			 * @default true
			 */
			this.enableRotate = true;

			/**
			 * Speed of rotation.
			 *
			 * @type {number}
			 * @default 1
			 */
			this.rotateSpeed = 1.0;

			/**
			 * How fast to rotate the camera when the keyboard is used.
			 *
			 * @type {number}
			 * @default 1
			 */
			this.keyRotateSpeed = 1.0;

			/**
			 * Enable or disable camera panning.
			 *
			 * @type {boolean}
			 * @default true
			 */
			this.enablePan = true;

			/**
			 * Speed of panning.
			 *
			 * @type {number}
			 * @default 1
			 */
			this.panSpeed = 1.0;

			/**
			 * Defines how the camera's position is translated when panning. If `true`, the camera pans
			 * in screen space. Otherwise, the camera pans in the plane orthogonal to the camera's up
			 * direction.
			 *
			 * @type {boolean}
			 * @default true
			 */
			this.screenSpacePanning = true;

			/**
			 * How fast to pan the camera when the keyboard is used in
			 * pixels per keypress.
			 *
			 * @type {number}
			 * @default 7
			 */
			this.keyPanSpeed = 7.0;

			/**
			 * Setting this property to `true` allows to zoom to the cursor's position.
			 *
			 * @type {boolean}
			 * @default false
			 */
			this.zoomToCursor = false;

			/**
			 * Set to true to automatically rotate around the target
			 *
			 * Note that if this is enabled, you must call `update()` in your animation loop.
			 * If you want the auto-rotate speed to be independent of the frame rate (the refresh
			 * rate of the display), you must pass the time `deltaTime`, in seconds, to `update()`.
			 *
			 * @type {boolean}
			 * @default false
			 */
			this.autoRotate = false;

			/**
			 * How fast to rotate around the target if `autoRotate` is `true`. The default  equates to 30 seconds
			 * per orbit at 60fps.
			 *
			 * Note that if `autoRotate` is enabled, you must call `update()` in your animation loop.
			 *
			 * @type {number}
			 * @default 2
			 */
			this.autoRotateSpeed = 2.0;

			/**
			 * This object contains references to the keycodes for controlling camera panning.
			 *
			 * ```js
			 * controls.keys = {
			 * 	LEFT: 'ArrowLeft', //left arrow
			 * 	UP: 'ArrowUp', // up arrow
			 * 	RIGHT: 'ArrowRight', // right arrow
			 * 	BOTTOM: 'ArrowDown' // down arrow
			 * }
			 * ```
			 * @type {Object}
			 */
			this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

			/**
			 * This object contains references to the mouse actions used by the controls.
			 *
			 * ```js
			 * controls.mouseButtons = {
			 * 	LEFT: THREE.MOUSE.ROTATE,
			 * 	MIDDLE: THREE.MOUSE.DOLLY,
			 * 	RIGHT: THREE.MOUSE.PAN
			 * }
			 * ```
			 * @type {Object}
			 */
			this.mouseButtons = { LEFT: three.MOUSE.ROTATE, MIDDLE: three.MOUSE.DOLLY, RIGHT: three.MOUSE.PAN };

			/**
			 * This object contains references to the touch actions used by the controls.
			 *
			 * ```js
			 * controls.mouseButtons = {
			 * 	ONE: THREE.TOUCH.ROTATE,
			 * 	TWO: THREE.TOUCH.DOLLY_PAN
			 * }
			 * ```
			 * @type {Object}
			 */
			this.touches = { ONE: three.TOUCH.ROTATE, TWO: three.TOUCH.DOLLY_PAN };

			/**
			 * Used internally by `saveState()` and `reset()`.
			 *
			 * @type {Vector3}
			 */
			this.target0 = this.target.clone();

			/**
			 * Used internally by `saveState()` and `reset()`.
			 *
			 * @type {Vector3}
			 */
			this.position0 = this.object.position.clone();

			/**
			 * Used internally by `saveState()` and `reset()`.
			 *
			 * @type {number}
			 */
			this.zoom0 = this.object.zoom;

			// the target DOM element for key events
			this._domElementKeyEvents = null;

			// internals

			this._lastPosition = new three.Vector3();
			this._lastQuaternion = new three.Quaternion();
			this._lastTargetPosition = new three.Vector3();

			// so camera.up is the orbit axis
			this._quat = new three.Quaternion().setFromUnitVectors( object.up, new three.Vector3( 0, 1, 0 ) );
			this._quatInverse = this._quat.clone().invert();

			// current position in spherical coordinates
			this._spherical = new three.Spherical();
			this._sphericalDelta = new three.Spherical();

			this._scale = 1;
			this._panOffset = new three.Vector3();

			this._rotateStart = new three.Vector2();
			this._rotateEnd = new three.Vector2();
			this._rotateDelta = new three.Vector2();

			this._panStart = new three.Vector2();
			this._panEnd = new three.Vector2();
			this._panDelta = new three.Vector2();

			this._dollyStart = new three.Vector2();
			this._dollyEnd = new three.Vector2();
			this._dollyDelta = new three.Vector2();

			this._dollyDirection = new three.Vector3();
			this._mouse = new three.Vector2();
			this._performCursorZoom = false;

			this._pointers = [];
			this._pointerPositions = {};

			this._controlActive = false;

			// event listeners

			this._onPointerMove = onPointerMove.bind( this );
			this._onPointerDown = onPointerDown.bind( this );
			this._onPointerUp = onPointerUp.bind( this );
			this._onContextMenu = onContextMenu.bind( this );
			this._onMouseWheel = onMouseWheel.bind( this );
			this._onKeyDown = onKeyDown.bind( this );

			this._onTouchStart = onTouchStart.bind( this );
			this._onTouchMove = onTouchMove.bind( this );

			this._onMouseDown = onMouseDown.bind( this );
			this._onMouseMove = onMouseMove.bind( this );

			this._interceptControlDown = interceptControlDown.bind( this );
			this._interceptControlUp = interceptControlUp.bind( this );

			//

			if ( this.domElement !== null ) {

				this.connect( this.domElement );

			}

			this.update();

		}

		connect( element ) {

			super.connect( element );

			this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.addEventListener( 'pointercancel', this._onPointerUp );

			this.domElement.addEventListener( 'contextmenu', this._onContextMenu );
			this.domElement.addEventListener( 'wheel', this._onMouseWheel, { passive: false } );

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility
			document.addEventListener( 'keydown', this._interceptControlDown, { passive: true, capture: true } );

			this.domElement.style.touchAction = 'none'; // disable touch scroll

		}

		disconnect() {

			this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.removeEventListener( 'pointerup', this._onPointerUp );
			this.domElement.removeEventListener( 'pointercancel', this._onPointerUp );

			this.domElement.removeEventListener( 'wheel', this._onMouseWheel );
			this.domElement.removeEventListener( 'contextmenu', this._onContextMenu );

			this.stopListenToKeyEvents();

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility
			document.removeEventListener( 'keydown', this._interceptControlDown, { capture: true } );

			this.domElement.style.touchAction = 'auto';

		}

		dispose() {

			this.disconnect();

		}

		/**
		 * Get the current vertical rotation, in radians.
		 *
		 * @return {number} The current vertical rotation, in radians.
		 */
		getPolarAngle() {

			return this._spherical.phi;

		}

		/**
		 * Get the current horizontal rotation, in radians.
		 *
		 * @return {number} The current horizontal rotation, in radians.
		 */
		getAzimuthalAngle() {

			return this._spherical.theta;

		}

		/**
		 * Returns the distance from the camera to the target.
		 *
		 * @return {number} The distance from the camera to the target.
		 */
		getDistance() {

			return this.object.position.distanceTo( this.target );

		}

		/**
		 * Adds key event listeners to the given DOM element.
		 * `window` is a recommended argument for using this method.
		 *
		 * @param {HTMLDOMElement} domElement - The DOM element
		 */
		listenToKeyEvents( domElement ) {

			domElement.addEventListener( 'keydown', this._onKeyDown );
			this._domElementKeyEvents = domElement;

		}

		/**
		 * Removes the key event listener previously defined with `listenToKeyEvents()`.
		 */
		stopListenToKeyEvents() {

			if ( this._domElementKeyEvents !== null ) {

				this._domElementKeyEvents.removeEventListener( 'keydown', this._onKeyDown );
				this._domElementKeyEvents = null;

			}

		}

		/**
		 * Save the current state of the controls. This can later be recovered with `reset()`.
		 */
		saveState() {

			this.target0.copy( this.target );
			this.position0.copy( this.object.position );
			this.zoom0 = this.object.zoom;

		}

		/**
		 * Reset the controls to their state from either the last time the `saveState()`
		 * was called, or the initial state.
		 */
		reset() {

			this.target.copy( this.target0 );
			this.object.position.copy( this.position0 );
			this.object.zoom = this.zoom0;

			this.object.updateProjectionMatrix();
			this.dispatchEvent( _changeEvent );

			this.update();

			this.state = _STATE.NONE;

		}

		update( deltaTime = null ) {

			const position = this.object.position;

			_v.copy( position ).sub( this.target );

			// rotate offset to "y-axis-is-up" space
			_v.applyQuaternion( this._quat );

			// angle from z-axis around y-axis
			this._spherical.setFromVector3( _v );

			if ( this.autoRotate && this.state === _STATE.NONE ) {

				this._rotateLeft( this._getAutoRotationAngle( deltaTime ) );

			}

			if ( this.enableDamping ) {

				this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
				this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;

			} else {

				this._spherical.theta += this._sphericalDelta.theta;
				this._spherical.phi += this._sphericalDelta.phi;

			}

			// restrict theta to be between desired limits

			let min = this.minAzimuthAngle;
			let max = this.maxAzimuthAngle;

			if ( isFinite( min ) && isFinite( max ) ) {

				if ( min < - Math.PI ) min += _twoPI; else if ( min > Math.PI ) min -= _twoPI;

				if ( max < - Math.PI ) max += _twoPI; else if ( max > Math.PI ) max -= _twoPI;

				if ( min <= max ) {

					this._spherical.theta = Math.max( min, Math.min( max, this._spherical.theta ) );

				} else {

					this._spherical.theta = ( this._spherical.theta > ( min + max ) / 2 ) ?
						Math.max( min, this._spherical.theta ) :
						Math.min( max, this._spherical.theta );

				}

			}

			// restrict phi to be between desired limits
			this._spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this._spherical.phi ) );

			this._spherical.makeSafe();


			// move target to panned location

			if ( this.enableDamping === true ) {

				this.target.addScaledVector( this._panOffset, this.dampingFactor );

			} else {

				this.target.add( this._panOffset );

			}

			// Limit the target distance from the cursor to create a sphere around the center of interest
			this.target.sub( this.cursor );
			this.target.clampLength( this.minTargetRadius, this.maxTargetRadius );
			this.target.add( this.cursor );

			let zoomChanged = false;
			// adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
			// we adjust zoom later in these cases
			if ( this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera ) {

				this._spherical.radius = this._clampDistance( this._spherical.radius );

			} else {

				const prevRadius = this._spherical.radius;
				this._spherical.radius = this._clampDistance( this._spherical.radius * this._scale );
				zoomChanged = prevRadius != this._spherical.radius;

			}

			_v.setFromSpherical( this._spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			_v.applyQuaternion( this._quatInverse );

			position.copy( this.target ).add( _v );

			this.object.lookAt( this.target );

			if ( this.enableDamping === true ) {

				this._sphericalDelta.theta *= ( 1 - this.dampingFactor );
				this._sphericalDelta.phi *= ( 1 - this.dampingFactor );

				this._panOffset.multiplyScalar( 1 - this.dampingFactor );

			} else {

				this._sphericalDelta.set( 0, 0, 0 );

				this._panOffset.set( 0, 0, 0 );

			}

			// adjust camera position
			if ( this.zoomToCursor && this._performCursorZoom ) {

				let newRadius = null;
				if ( this.object.isPerspectiveCamera ) {

					// move the camera down the pointer ray
					// this method avoids floating point error
					const prevRadius = _v.length();
					newRadius = this._clampDistance( prevRadius * this._scale );

					const radiusDelta = prevRadius - newRadius;
					this.object.position.addScaledVector( this._dollyDirection, radiusDelta );
					this.object.updateMatrixWorld();

					zoomChanged = !! radiusDelta;

				} else if ( this.object.isOrthographicCamera ) {

					// adjust the ortho camera position based on zoom changes
					const mouseBefore = new three.Vector3( this._mouse.x, this._mouse.y, 0 );
					mouseBefore.unproject( this.object );

					const prevZoom = this.object.zoom;
					this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );
					this.object.updateProjectionMatrix();

					zoomChanged = prevZoom !== this.object.zoom;

					const mouseAfter = new three.Vector3( this._mouse.x, this._mouse.y, 0 );
					mouseAfter.unproject( this.object );

					this.object.position.sub( mouseAfter ).add( mouseBefore );
					this.object.updateMatrixWorld();

					newRadius = _v.length();

				} else {

					console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
					this.zoomToCursor = false;

				}

				// handle the placement of the target
				if ( newRadius !== null ) {

					if ( this.screenSpacePanning ) {

						// position the orbit target in front of the new camera position
						this.target.set( 0, 0, -1 )
							.transformDirection( this.object.matrix )
							.multiplyScalar( newRadius )
							.add( this.object.position );

					} else {

						// get the ray and translation plane to compute target
						_ray.origin.copy( this.object.position );
						_ray.direction.set( 0, 0, -1 ).transformDirection( this.object.matrix );

						// if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
						// extremely large values
						if ( Math.abs( this.object.up.dot( _ray.direction ) ) < _TILT_LIMIT ) {

							this.object.lookAt( this.target );

						} else {

							_plane$1.setFromNormalAndCoplanarPoint( this.object.up, this.target );
							_ray.intersectPlane( _plane$1, this.target );

						}

					}

				}

			} else if ( this.object.isOrthographicCamera ) {

				const prevZoom = this.object.zoom;
				this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );

				if ( prevZoom !== this.object.zoom ) {

					this.object.updateProjectionMatrix();
					zoomChanged = true;

				}

			}

			this._scale = 1;
			this._performCursorZoom = false;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				this._lastPosition.distanceToSquared( this.object.position ) > _EPS ||
				8 * ( 1 - this._lastQuaternion.dot( this.object.quaternion ) ) > _EPS ||
				this._lastTargetPosition.distanceToSquared( this.target ) > _EPS ) {

				this.dispatchEvent( _changeEvent );

				this._lastPosition.copy( this.object.position );
				this._lastQuaternion.copy( this.object.quaternion );
				this._lastTargetPosition.copy( this.target );

				return true;

			}

			return false;

		}

		_getAutoRotationAngle( deltaTime ) {

			if ( deltaTime !== null ) {

				return ( _twoPI / 60 * this.autoRotateSpeed ) * deltaTime;

			} else {

				return _twoPI / 60 / 60 * this.autoRotateSpeed;

			}

		}

		_getZoomScale( delta ) {

			const normalizedDelta = Math.abs( delta * 0.01 );
			return Math.pow( 0.95, this.zoomSpeed * normalizedDelta );

		}

		_rotateLeft( angle ) {

			this._sphericalDelta.theta -= angle;

		}

		_rotateUp( angle ) {

			this._sphericalDelta.phi -= angle;

		}

		_panLeft( distance, objectMatrix ) {

			_v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			_v.multiplyScalar( - distance );

			this._panOffset.add( _v );

		}

		_panUp( distance, objectMatrix ) {

			if ( this.screenSpacePanning === true ) {

				_v.setFromMatrixColumn( objectMatrix, 1 );

			} else {

				_v.setFromMatrixColumn( objectMatrix, 0 );
				_v.crossVectors( this.object.up, _v );

			}

			_v.multiplyScalar( distance );

			this._panOffset.add( _v );

		}

		// deltaX and deltaY are in pixels; right and down are positive
		_pan( deltaX, deltaY ) {

			const element = this.domElement;

			if ( this.object.isPerspectiveCamera ) {

				// perspective
				const position = this.object.position;
				_v.copy( position ).sub( this.target );
				let targetDistance = _v.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );

				// we use only clientHeight here so aspect ratio does not distort speed
				this._panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.object.matrix );
				this._panUp( 2 * deltaY * targetDistance / element.clientHeight, this.object.matrix );

			} else if ( this.object.isOrthographicCamera ) {

				// orthographic
				this._panLeft( deltaX * ( this.object.right - this.object.left ) / this.object.zoom / element.clientWidth, this.object.matrix );
				this._panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom / element.clientHeight, this.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				this.enablePan = false;

			}

		}

		_dollyOut( dollyScale ) {

			if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

				this._scale /= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;

			}

		}

		_dollyIn( dollyScale ) {

			if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

				this._scale *= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;

			}

		}

		_updateZoomParameters( x, y ) {

			if ( ! this.zoomToCursor ) {

				return;

			}

			this._performCursorZoom = true;

			const rect = this.domElement.getBoundingClientRect();
			const dx = x - rect.left;
			const dy = y - rect.top;
			const w = rect.width;
			const h = rect.height;

			this._mouse.x = ( dx / w ) * 2 - 1;
			this._mouse.y = - ( dy / h ) * 2 + 1;

			this._dollyDirection.set( this._mouse.x, this._mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();

		}

		_clampDistance( dist ) {

			return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );

		}

		//
		// event callbacks - update the object state
		//

		_handleMouseDownRotate( event ) {

			this._rotateStart.set( event.clientX, event.clientY );

		}

		_handleMouseDownDolly( event ) {

			this._updateZoomParameters( event.clientX, event.clientX );
			this._dollyStart.set( event.clientX, event.clientY );

		}

		_handleMouseDownPan( event ) {

			this._panStart.set( event.clientX, event.clientY );

		}

		_handleMouseMoveRotate( event ) {

			this._rotateEnd.set( event.clientX, event.clientY );

			this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

			const element = this.domElement;

			this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

			this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

			this._rotateStart.copy( this._rotateEnd );

			this.update();

		}

		_handleMouseMoveDolly( event ) {

			this._dollyEnd.set( event.clientX, event.clientY );

			this._dollyDelta.subVectors( this._dollyEnd, this._dollyStart );

			if ( this._dollyDelta.y > 0 ) {

				this._dollyOut( this._getZoomScale( this._dollyDelta.y ) );

			} else if ( this._dollyDelta.y < 0 ) {

				this._dollyIn( this._getZoomScale( this._dollyDelta.y ) );

			}

			this._dollyStart.copy( this._dollyEnd );

			this.update();

		}

		_handleMouseMovePan( event ) {

			this._panEnd.set( event.clientX, event.clientY );

			this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

			this._pan( this._panDelta.x, this._panDelta.y );

			this._panStart.copy( this._panEnd );

			this.update();

		}

		_handleMouseWheel( event ) {

			this._updateZoomParameters( event.clientX, event.clientY );

			if ( event.deltaY < 0 ) {

				this._dollyIn( this._getZoomScale( event.deltaY ) );

			} else if ( event.deltaY > 0 ) {

				this._dollyOut( this._getZoomScale( event.deltaY ) );

			}

			this.update();

		}

		_handleKeyDown( event ) {

			let needsUpdate = false;

			switch ( event.code ) {

				case this.keys.UP:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateUp( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( 0, this.keyPanSpeed );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.BOTTOM:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateUp( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( 0, - this.keyPanSpeed );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.LEFT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateLeft( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( this.keyPanSpeed, 0 );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.RIGHT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateLeft( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( - this.keyPanSpeed, 0 );

						}

					}

					needsUpdate = true;
					break;

			}

			if ( needsUpdate ) {

				// prevent the browser from scrolling on cursor keys
				event.preventDefault();

				this.update();

			}


		}

		_handleTouchStartRotate( event ) {

			if ( this._pointers.length === 1 ) {

				this._rotateStart.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._rotateStart.set( x, y );

			}

		}

		_handleTouchStartPan( event ) {

			if ( this._pointers.length === 1 ) {

				this._panStart.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._panStart.set( x, y );

			}

		}

		_handleTouchStartDolly( event ) {

			const position = this._getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			this._dollyStart.set( 0, distance );

		}

		_handleTouchStartDollyPan( event ) {

			if ( this.enableZoom ) this._handleTouchStartDolly( event );

			if ( this.enablePan ) this._handleTouchStartPan( event );

		}

		_handleTouchStartDollyRotate( event ) {

			if ( this.enableZoom ) this._handleTouchStartDolly( event );

			if ( this.enableRotate ) this._handleTouchStartRotate( event );

		}

		_handleTouchMoveRotate( event ) {

			if ( this._pointers.length == 1 ) {

				this._rotateEnd.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._rotateEnd.set( x, y );

			}

			this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

			const element = this.domElement;

			this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

			this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

			this._rotateStart.copy( this._rotateEnd );

		}

		_handleTouchMovePan( event ) {

			if ( this._pointers.length === 1 ) {

				this._panEnd.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._panEnd.set( x, y );

			}

			this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

			this._pan( this._panDelta.x, this._panDelta.y );

			this._panStart.copy( this._panEnd );

		}

		_handleTouchMoveDolly( event ) {

			const position = this._getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			this._dollyEnd.set( 0, distance );

			this._dollyDelta.set( 0, Math.pow( this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed ) );

			this._dollyOut( this._dollyDelta.y );

			this._dollyStart.copy( this._dollyEnd );

			const centerX = ( event.pageX + position.x ) * 0.5;
			const centerY = ( event.pageY + position.y ) * 0.5;

			this._updateZoomParameters( centerX, centerY );

		}

		_handleTouchMoveDollyPan( event ) {

			if ( this.enableZoom ) this._handleTouchMoveDolly( event );

			if ( this.enablePan ) this._handleTouchMovePan( event );

		}

		_handleTouchMoveDollyRotate( event ) {

			if ( this.enableZoom ) this._handleTouchMoveDolly( event );

			if ( this.enableRotate ) this._handleTouchMoveRotate( event );

		}

		// pointers

		_addPointer( event ) {

			this._pointers.push( event.pointerId );

		}

		_removePointer( event ) {

			delete this._pointerPositions[ event.pointerId ];

			for ( let i = 0; i < this._pointers.length; i ++ ) {

				if ( this._pointers[ i ] == event.pointerId ) {

					this._pointers.splice( i, 1 );
					return;

				}

			}

		}

		_isTrackingPointer( event ) {

			for ( let i = 0; i < this._pointers.length; i ++ ) {

				if ( this._pointers[ i ] == event.pointerId ) return true;

			}

			return false;

		}

		_trackPointer( event ) {

			let position = this._pointerPositions[ event.pointerId ];

			if ( position === undefined ) {

				position = new three.Vector2();
				this._pointerPositions[ event.pointerId ] = position;

			}

			position.set( event.pageX, event.pageY );

		}

		_getSecondPointerPosition( event ) {

			const pointerId = ( event.pointerId === this._pointers[ 0 ] ) ? this._pointers[ 1 ] : this._pointers[ 0 ];

			return this._pointerPositions[ pointerId ];

		}

		//

		_customWheelEvent( event ) {

			const mode = event.deltaMode;

			// minimal wheel event altered to meet delta-zoom demand
			const newEvent = {
				clientX: event.clientX,
				clientY: event.clientY,
				deltaY: event.deltaY,
			};

			switch ( mode ) {

				case 1: // LINE_MODE
					newEvent.deltaY *= 16;
					break;

				case 2: // PAGE_MODE
					newEvent.deltaY *= 100;
					break;

			}

			// detect if event was triggered by pinching
			if ( event.ctrlKey && ! this._controlActive ) {

				newEvent.deltaY *= 10;

			}

			return newEvent;

		}

	}

	function onPointerDown( event ) {

		if ( this.enabled === false ) return;

		if ( this._pointers.length === 0 ) {

			this.domElement.setPointerCapture( event.pointerId );

			this.domElement.addEventListener( 'pointermove', this._onPointerMove );
			this.domElement.addEventListener( 'pointerup', this._onPointerUp );

		}

		//

		if ( this._isTrackingPointer( event ) ) return;

		//

		this._addPointer( event );

		if ( event.pointerType === 'touch' ) {

			this._onTouchStart( event );

		} else {

			this._onMouseDown( event );

		}

	}

	function onPointerMove( event ) {

		if ( this.enabled === false ) return;

		if ( event.pointerType === 'touch' ) {

			this._onTouchMove( event );

		} else {

			this._onMouseMove( event );

		}

	}

	function onPointerUp( event ) {

		this._removePointer( event );

		switch ( this._pointers.length ) {

			case 0:

				this.domElement.releasePointerCapture( event.pointerId );

				this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
				this.domElement.removeEventListener( 'pointerup', this._onPointerUp );

				this.dispatchEvent( _endEvent );

				this.state = _STATE.NONE;

				break;

			case 1:

				const pointerId = this._pointers[ 0 ];
				const position = this._pointerPositions[ pointerId ];

				// minimal placeholder event - allows state correction on pointer-up
				this._onTouchStart( { pointerId: pointerId, pageX: position.x, pageY: position.y } );

				break;

		}

	}

	function onMouseDown( event ) {

		let mouseAction;

		switch ( event.button ) {

			case 0:

				mouseAction = this.mouseButtons.LEFT;
				break;

			case 1:

				mouseAction = this.mouseButtons.MIDDLE;
				break;

			case 2:

				mouseAction = this.mouseButtons.RIGHT;
				break;

			default:

				mouseAction = -1;

		}

		switch ( mouseAction ) {

			case three.MOUSE.DOLLY:

				if ( this.enableZoom === false ) return;

				this._handleMouseDownDolly( event );

				this.state = _STATE.DOLLY;

				break;

			case three.MOUSE.ROTATE:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enablePan === false ) return;

					this._handleMouseDownPan( event );

					this.state = _STATE.PAN;

				} else {

					if ( this.enableRotate === false ) return;

					this._handleMouseDownRotate( event );

					this.state = _STATE.ROTATE;

				}

				break;

			case three.MOUSE.PAN:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate === false ) return;

					this._handleMouseDownRotate( event );

					this.state = _STATE.ROTATE;

				} else {

					if ( this.enablePan === false ) return;

					this._handleMouseDownPan( event );

					this.state = _STATE.PAN;

				}

				break;

			default:

				this.state = _STATE.NONE;

		}

		if ( this.state !== _STATE.NONE ) {

			this.dispatchEvent( _startEvent );

		}

	}

	function onMouseMove( event ) {

		switch ( this.state ) {

			case _STATE.ROTATE:

				if ( this.enableRotate === false ) return;

				this._handleMouseMoveRotate( event );

				break;

			case _STATE.DOLLY:

				if ( this.enableZoom === false ) return;

				this._handleMouseMoveDolly( event );

				break;

			case _STATE.PAN:

				if ( this.enablePan === false ) return;

				this._handleMouseMovePan( event );

				break;

		}

	}

	function onMouseWheel( event ) {

		if ( this.enabled === false || this.enableZoom === false || this.state !== _STATE.NONE ) return;

		event.preventDefault();

		this.dispatchEvent( _startEvent );

		this._handleMouseWheel( this._customWheelEvent( event ) );

		this.dispatchEvent( _endEvent );

	}

	function onKeyDown( event ) {

		if ( this.enabled === false ) return;

		this._handleKeyDown( event );

	}

	function onTouchStart( event ) {

		this._trackPointer( event );

		switch ( this._pointers.length ) {

			case 1:

				switch ( this.touches.ONE ) {

					case three.TOUCH.ROTATE:

						if ( this.enableRotate === false ) return;

						this._handleTouchStartRotate( event );

						this.state = _STATE.TOUCH_ROTATE;

						break;

					case three.TOUCH.PAN:

						if ( this.enablePan === false ) return;

						this._handleTouchStartPan( event );

						this.state = _STATE.TOUCH_PAN;

						break;

					default:

						this.state = _STATE.NONE;

				}

				break;

			case 2:

				switch ( this.touches.TWO ) {

					case three.TOUCH.DOLLY_PAN:

						if ( this.enableZoom === false && this.enablePan === false ) return;

						this._handleTouchStartDollyPan( event );

						this.state = _STATE.TOUCH_DOLLY_PAN;

						break;

					case three.TOUCH.DOLLY_ROTATE:

						if ( this.enableZoom === false && this.enableRotate === false ) return;

						this._handleTouchStartDollyRotate( event );

						this.state = _STATE.TOUCH_DOLLY_ROTATE;

						break;

					default:

						this.state = _STATE.NONE;

				}

				break;

			default:

				this.state = _STATE.NONE;

		}

		if ( this.state !== _STATE.NONE ) {

			this.dispatchEvent( _startEvent );

		}

	}

	function onTouchMove( event ) {

		this._trackPointer( event );

		switch ( this.state ) {

			case _STATE.TOUCH_ROTATE:

				if ( this.enableRotate === false ) return;

				this._handleTouchMoveRotate( event );

				this.update();

				break;

			case _STATE.TOUCH_PAN:

				if ( this.enablePan === false ) return;

				this._handleTouchMovePan( event );

				this.update();

				break;

			case _STATE.TOUCH_DOLLY_PAN:

				if ( this.enableZoom === false && this.enablePan === false ) return;

				this._handleTouchMoveDollyPan( event );

				this.update();

				break;

			case _STATE.TOUCH_DOLLY_ROTATE:

				if ( this.enableZoom === false && this.enableRotate === false ) return;

				this._handleTouchMoveDollyRotate( event );

				this.update();

				break;

			default:

				this.state = _STATE.NONE;

		}

	}

	function onContextMenu( event ) {

		if ( this.enabled === false ) return;

		event.preventDefault();

	}

	function interceptControlDown( event ) {

		if ( event.key === 'Control' ) {

			this._controlActive = true;

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility

			document.addEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

		}

	}

	function interceptControlUp( event ) {

		if ( event.key === 'Control' ) {

			this._controlActive = false;

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility

			document.removeEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

		}

	}

	const Visible = 0;
	const Deleted = 1;

	const _v1 = new three.Vector3();
	const _line3 = new three.Line3();
	const _plane = new three.Plane();
	const _closestPoint = new three.Vector3();
	const _triangle = new three.Triangle();

	/**
	 * Can be used to compute the convex hull in 3D space for a given set of points. It
	 * is primarily intended for {@link ConvexGeometry}.
	 *
	 * This Quickhull 3D implementation is a port of [quickhull3d]{@link https://github.com/maurizzzio/quickhull3d/}
	 * by Mauricio Poppe.
	 *
	 * @three_import import { ConvexHull } from 'three/addons/math/ConvexHull.js';
	 */
	class ConvexHull {

		/**
		 * Constructs a new convex hull.
		 */
		constructor() {

			this.tolerance = -1;

			this.faces = []; // the generated faces of the convex hull
			this.newFaces = []; // this array holds the faces that are generated within a single iteration

			// the vertex lists work as follows:
			//
			// let 'a' and 'b' be 'Face' instances
			// let 'v' be points wrapped as instance of 'Vertex'
			//
			//     [v, v, ..., v, v, v, ...]
			//      ^             ^
			//      |             |
			//  a.outside     b.outside
			//
			this.assigned = new VertexList();
			this.unassigned = new VertexList();

			this.vertices = []; // vertices of the hull (internal representation of given geometry data)

		}

		/**
		 * Computes to convex hull for the given array of points.
		 *
		 * @param {Array<Vector3>} points - The array of points in 3D space.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		setFromPoints( points ) {

			// The algorithm needs at least four points.

			if ( points.length >= 4 ) {

				this.makeEmpty();

				for ( let i = 0, l = points.length; i < l; i ++ ) {

					this.vertices.push( new VertexNode( points[ i ] ) );

				}

				this._compute();

			}

			return this;

		}

		/**
		 * Computes the convex hull of the given 3D object (including its descendants),
		 * accounting for the world transforms of both the 3D object and its descendants.
		 *
		 * @param {Object3D} object - The 3D object to compute the convex hull for.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		setFromObject( object ) {

			const points = [];

			object.updateMatrixWorld( true );

			object.traverse( function ( node ) {

				const geometry = node.geometry;

				if ( geometry !== undefined ) {

					const attribute = geometry.attributes.position;

					if ( attribute !== undefined ) {

						for ( let i = 0, l = attribute.count; i < l; i ++ ) {

							const point = new three.Vector3();

							point.fromBufferAttribute( attribute, i ).applyMatrix4( node.matrixWorld );

							points.push( point );

						}

					}

				}

			} );

			return this.setFromPoints( points );

		}

		/**
		 * Returns `true` if the given point lies in the convex hull.
		 *
		 * @param {Vector3} point - The point to test.
		 * @return {boolean} Whether the given point lies in the convex hull or not.
		 */
		containsPoint( point ) {

			const faces = this.faces;

			for ( let i = 0, l = faces.length; i < l; i ++ ) {

				const face = faces[ i ];

				// compute signed distance and check on what half space the point lies

				if ( face.distanceToPoint( point ) > this.tolerance ) return false;

			}

			return true;

		}

		/**
		 * Computes the intersections point of the given ray and this convex hull.
		 *
		 * @param {Ray} ray - The ray to test.
		 * @param {Vector3} target - The target vector that is used to store the method's result.
		 * @return {Vector3|null} The intersection point. Returns `null` if not intersection was detected.
		 */
		intersectRay( ray, target ) {

			// based on "Fast Ray-Convex Polyhedron Intersection" by Eric Haines, GRAPHICS GEMS II

			const faces = this.faces;

			let tNear = - Infinity;
			let tFar = Infinity;

			for ( let i = 0, l = faces.length; i < l; i ++ ) {

				const face = faces[ i ];

				// interpret faces as planes for the further computation

				const vN = face.distanceToPoint( ray.origin );
				const vD = face.normal.dot( ray.direction );

				// if the origin is on the positive side of a plane (so the plane can "see" the origin) and
				// the ray is turned away or parallel to the plane, there is no intersection

				if ( vN > 0 && vD >= 0 ) return null;

				// compute the distance from the ray’s origin to the intersection with the plane

				const t = ( vD !== 0 ) ? ( - vN / vD ) : 0;

				// only proceed if the distance is positive. a negative distance means the intersection point
				// lies "behind" the origin

				if ( t <= 0 ) continue;

				// now categorized plane as front-facing or back-facing

				if ( vD > 0 ) {

					// plane faces away from the ray, so this plane is a back-face

					tFar = Math.min( t, tFar );

				} else {

					// front-face

					tNear = Math.max( t, tNear );

				}

				if ( tNear > tFar ) {

					// if tNear ever is greater than tFar, the ray must miss the convex hull

					return null;

				}

			}

			// evaluate intersection point

			// always try tNear first since its the closer intersection point

			if ( tNear !== - Infinity ) {

				ray.at( tNear, target );

			} else {

				ray.at( tFar, target );

			}

			return target;

		}

		/**
		 * Returns `true` if the given ray intersects with this convex hull.
		 *
		 * @param {Ray} ray - The ray to test.
		 * @return {boolean} Whether the given ray intersects with this convex hull or not.
		 */
		intersectsRay( ray ) {

			return this.intersectRay( ray, _v1 ) !== null;

		}

		/**
		 * Makes the convex hull empty.
		 *
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		makeEmpty() {

			this.faces = [];
			this.vertices = [];

			return this;

		}

		// private

		/**
		 * Adds a vertex to the 'assigned' list of vertices and assigns it to the given face.
		 *
		 * @private
		 * @param {VertexNode} vertex - The vertex to add.
		 * @param {Face} face - The target face.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_addVertexToFace( vertex, face ) {

			vertex.face = face;

			if ( face.outside === null ) {

				this.assigned.append( vertex );

			} else {

				this.assigned.insertBefore( face.outside, vertex );

			}

			face.outside = vertex;

			return this;

		}

		/**
		 * Removes a vertex from the 'assigned' list of vertices and from the given face.
		 * It also makes sure that the link from 'face' to the first vertex it sees in 'assigned'
		 * is linked correctly after the removal.
		 *
		 * @private
		 * @param {VertexNode} vertex - The vertex to remove.
		 * @param {Face} face - The target face.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_removeVertexFromFace( vertex, face ) {

			if ( vertex === face.outside ) {

				// fix face.outside link

				if ( vertex.next !== null && vertex.next.face === face ) {

					// face has at least 2 outside vertices, move the 'outside' reference

					face.outside = vertex.next;

				} else {

					// vertex was the only outside vertex that face had

					face.outside = null;

				}

			}

			this.assigned.remove( vertex );

			return this;

		}

		/**
		 * Removes all the visible vertices that a given face is able to see which are stored in
		 * the 'assigned' vertex list.
		 *
		 * @private
		 * @param {Face} face - The target face.
		 * @return {VertexNode|undefined} A reference to this convex hull.
		 */
		_removeAllVerticesFromFace( face ) {

			if ( face.outside !== null ) {

				// reference to the first and last vertex of this face

				const start = face.outside;
				let end = face.outside;

				while ( end.next !== null && end.next.face === face ) {

					end = end.next;

				}

				this.assigned.removeSubList( start, end );

				// fix references

				start.prev = end.next = null;
				face.outside = null;

				return start;

			}

		}

		/**
		 * Removes all the visible vertices that `face` is able to see.
		 *
		 * - If `absorbingFace` doesn't exist, then all the removed vertices will be added to the 'unassigned' vertex list.
		 * - If `absorbingFace` exists, then this method will assign all the vertices of 'face' that can see 'absorbingFace'.
		 * - If a vertex cannot see `absorbingFace`, it's added to the 'unassigned' vertex list.
		 *
		 * @private
		 * @param {Face} face - The given face.
		 * @param {Face} [absorbingFace] - An optional face that tries to absorb the vertices of the first face.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_deleteFaceVertices( face, absorbingFace ) {

			const faceVertices = this._removeAllVerticesFromFace( face );

			if ( faceVertices !== undefined ) {

				if ( absorbingFace === undefined ) {

					// mark the vertices to be reassigned to some other face

					this.unassigned.appendChain( faceVertices );


				} else {

					// if there's an absorbing face try to assign as many vertices as possible to it

					let vertex = faceVertices;

					do {

						// we need to buffer the subsequent vertex at this point because the 'vertex.next' reference
						// will be changed by upcoming method calls

						const nextVertex = vertex.next;

						const distance = absorbingFace.distanceToPoint( vertex.point );

						// check if 'vertex' is able to see 'absorbingFace'

						if ( distance > this.tolerance ) {

							this._addVertexToFace( vertex, absorbingFace );

						} else {

							this.unassigned.append( vertex );

						}

						// now assign next vertex

						vertex = nextVertex;

					} while ( vertex !== null );

				}

			}

			return this;

		}

		/**
		 * Reassigns as many vertices as possible from the unassigned list to the new faces.
		 *
		 * @private
		 * @param {Array<Face>} newFaces - The new faces.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_resolveUnassignedPoints( newFaces ) {

			if ( this.unassigned.isEmpty() === false ) {

				let vertex = this.unassigned.first();

				do {

					// buffer 'next' reference, see ._deleteFaceVertices()

					const nextVertex = vertex.next;

					let maxDistance = this.tolerance;

					let maxFace = null;

					for ( let i = 0; i < newFaces.length; i ++ ) {

						const face = newFaces[ i ];

						if ( face.mark === Visible ) {

							const distance = face.distanceToPoint( vertex.point );

							if ( distance > maxDistance ) {

								maxDistance = distance;
								maxFace = face;

							}

							if ( maxDistance > 1000 * this.tolerance ) break;

						}

					}

					// 'maxFace' can be null e.g. if there are identical vertices

					if ( maxFace !== null ) {

						this._addVertexToFace( vertex, maxFace );

					}

					vertex = nextVertex;

				} while ( vertex !== null );

			}

			return this;

		}

		/**
		 * Computes the extremes values (min/max vectors) which will be used to
		 * compute the initial hull.
		 *
		 * @private
		 * @return {Object} The extremes.
		 */
		_computeExtremes() {

			const min = new three.Vector3();
			const max = new three.Vector3();

			const minVertices = [];
			const maxVertices = [];

			// initially assume that the first vertex is the min/max

			for ( let i = 0; i < 3; i ++ ) {

				minVertices[ i ] = maxVertices[ i ] = this.vertices[ 0 ];

			}

			min.copy( this.vertices[ 0 ].point );
			max.copy( this.vertices[ 0 ].point );

			// compute the min/max vertex on all six directions

			for ( let i = 0, l = this.vertices.length; i < l; i ++ ) {

				const vertex = this.vertices[ i ];
				const point = vertex.point;

				// update the min coordinates

				for ( let j = 0; j < 3; j ++ ) {

					if ( point.getComponent( j ) < min.getComponent( j ) ) {

						min.setComponent( j, point.getComponent( j ) );
						minVertices[ j ] = vertex;

					}

				}

				// update the max coordinates

				for ( let j = 0; j < 3; j ++ ) {

					if ( point.getComponent( j ) > max.getComponent( j ) ) {

						max.setComponent( j, point.getComponent( j ) );
						maxVertices[ j ] = vertex;

					}

				}

			}

			// use min/max vectors to compute an optimal epsilon

			this.tolerance = 3 * Number.EPSILON * (
				Math.max( Math.abs( min.x ), Math.abs( max.x ) ) +
				Math.max( Math.abs( min.y ), Math.abs( max.y ) ) +
				Math.max( Math.abs( min.z ), Math.abs( max.z ) )
			);

			return { min: minVertices, max: maxVertices };

		}

		/**
		 * Computes the initial simplex assigning to its faces all the points that are
		 * candidates to form part of the hull.
		 *
		 * @private
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_computeInitialHull() {

			const vertices = this.vertices;
			const extremes = this._computeExtremes();
			const min = extremes.min;
			const max = extremes.max;

			// 1. Find the two vertices 'v0' and 'v1' with the greatest 1d separation
			// (max.x - min.x)
			// (max.y - min.y)
			// (max.z - min.z)

			let maxDistance = 0;
			let index = 0;

			for ( let i = 0; i < 3; i ++ ) {

				const distance = max[ i ].point.getComponent( i ) - min[ i ].point.getComponent( i );

				if ( distance > maxDistance ) {

					maxDistance = distance;
					index = i;

				}

			}

			const v0 = min[ index ];
			const v1 = max[ index ];
			let v2;
			let v3;

			// 2. The next vertex 'v2' is the one farthest to the line formed by 'v0' and 'v1'

			maxDistance = 0;
			_line3.set( v0.point, v1.point );

			for ( let i = 0, l = this.vertices.length; i < l; i ++ ) {

				const vertex = vertices[ i ];

				if ( vertex !== v0 && vertex !== v1 ) {

					_line3.closestPointToPoint( vertex.point, true, _closestPoint );

					const distance = _closestPoint.distanceToSquared( vertex.point );

					if ( distance > maxDistance ) {

						maxDistance = distance;
						v2 = vertex;

					}

				}

			}

			// 3. The next vertex 'v3' is the one farthest to the plane 'v0', 'v1', 'v2'

			maxDistance = -1;
			_plane.setFromCoplanarPoints( v0.point, v1.point, v2.point );

			for ( let i = 0, l = this.vertices.length; i < l; i ++ ) {

				const vertex = vertices[ i ];

				if ( vertex !== v0 && vertex !== v1 && vertex !== v2 ) {

					const distance = Math.abs( _plane.distanceToPoint( vertex.point ) );

					if ( distance > maxDistance ) {

						maxDistance = distance;
						v3 = vertex;

					}

				}

			}

			const faces = [];

			if ( _plane.distanceToPoint( v3.point ) < 0 ) {

				// the face is not able to see the point so 'plane.normal' is pointing outside the tetrahedron

				faces.push(
					Face.create( v0, v1, v2 ),
					Face.create( v3, v1, v0 ),
					Face.create( v3, v2, v1 ),
					Face.create( v3, v0, v2 )
				);

				// set the twin edge

				for ( let i = 0; i < 3; i ++ ) {

					const j = ( i + 1 ) % 3;

					// join face[ i ] i > 0, with the first face

					faces[ i + 1 ].getEdge( 2 ).setTwin( faces[ 0 ].getEdge( j ) );

					// join face[ i ] with face[ i + 1 ], 1 <= i <= 3

					faces[ i + 1 ].getEdge( 1 ).setTwin( faces[ j + 1 ].getEdge( 0 ) );

				}

			} else {

				// the face is able to see the point so 'plane.normal' is pointing inside the tetrahedron

				faces.push(
					Face.create( v0, v2, v1 ),
					Face.create( v3, v0, v1 ),
					Face.create( v3, v1, v2 ),
					Face.create( v3, v2, v0 )
				);

				// set the twin edge

				for ( let i = 0; i < 3; i ++ ) {

					const j = ( i + 1 ) % 3;

					// join face[ i ] i > 0, with the first face

					faces[ i + 1 ].getEdge( 2 ).setTwin( faces[ 0 ].getEdge( ( 3 - i ) % 3 ) );

					// join face[ i ] with face[ i + 1 ]

					faces[ i + 1 ].getEdge( 0 ).setTwin( faces[ j + 1 ].getEdge( 1 ) );

				}

			}

			// the initial hull is the tetrahedron

			for ( let i = 0; i < 4; i ++ ) {

				this.faces.push( faces[ i ] );

			}

			// initial assignment of vertices to the faces of the tetrahedron

			for ( let i = 0, l = vertices.length; i < l; i ++ ) {

				const vertex = vertices[ i ];

				if ( vertex !== v0 && vertex !== v1 && vertex !== v2 && vertex !== v3 ) {

					maxDistance = this.tolerance;
					let maxFace = null;

					for ( let j = 0; j < 4; j ++ ) {

						const distance = this.faces[ j ].distanceToPoint( vertex.point );

						if ( distance > maxDistance ) {

							maxDistance = distance;
							maxFace = this.faces[ j ];

						}

					}

					if ( maxFace !== null ) {

						this._addVertexToFace( vertex, maxFace );

					}

				}

			}

			return this;

		}

		/**
		 * Removes inactive (e.g. deleted) faces from the internal face list.
		 *
		 * @private
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_reindexFaces() {

			const activeFaces = [];

			for ( let i = 0; i < this.faces.length; i ++ ) {

				const face = this.faces[ i ];

				if ( face.mark === Visible ) {

					activeFaces.push( face );

				}

			}

			this.faces = activeFaces;

			return this;

		}

		/**
		 * Finds the next vertex to create faces with the current hull.
		 *
		 * - Let the initial face be the first face existing in the 'assigned' vertex list.
		 * - If a face doesn't exist then return since there're no vertices left.
		 * - Otherwise for each vertex that face sees find the one furthest away from it.
		 *
		 * @private
		 * @return {?VertexNode} The next vertex to add.
		 */
		_nextVertexToAdd() {

			// if the 'assigned' list of vertices is empty, no vertices are left. return with 'undefined'

			if ( this.assigned.isEmpty() === false ) {

				let eyeVertex, maxDistance = 0;

				// grab the first available face and start with the first visible vertex of that face

				const eyeFace = this.assigned.first().face;
				let vertex = eyeFace.outside;

				// now calculate the farthest vertex that face can see

				do {

					const distance = eyeFace.distanceToPoint( vertex.point );

					if ( distance > maxDistance ) {

						maxDistance = distance;
						eyeVertex = vertex;

					}

					vertex = vertex.next;

				} while ( vertex !== null && vertex.face === eyeFace );

				return eyeVertex;

			}

		}

		/**
		 * Computes a chain of half edges in CCW order called the 'horizon'. For an edge
		 * to be part of the horizon it must join a face that can see 'eyePoint' and a face
		 * that cannot see 'eyePoint'.
		 *
		 * @private
		 * @param {Vector3} eyePoint - The 3D-coordinates of a point.
		 * @param {HalfEdge} crossEdge - The edge used to jump to the current face.
		 * @param {Face} face - The current face being tested.
		 * @param {Array<HalfEdge>} horizon - The edges that form part of the horizon in CCW order.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_computeHorizon( eyePoint, crossEdge, face, horizon ) {

			// moves face's vertices to the 'unassigned' vertex list

			this._deleteFaceVertices( face );

			face.mark = Deleted;

			let edge;

			if ( crossEdge === null ) {

				edge = crossEdge = face.getEdge( 0 );

			} else {

				// start from the next edge since 'crossEdge' was already analyzed
				// (actually 'crossEdge.twin' was the edge who called this method recursively)

				edge = crossEdge.next;

			}

			do {

				const twinEdge = edge.twin;
				const oppositeFace = twinEdge.face;

				if ( oppositeFace.mark === Visible ) {

					if ( oppositeFace.distanceToPoint( eyePoint ) > this.tolerance ) {

						// the opposite face can see the vertex, so proceed with next edge

						this._computeHorizon( eyePoint, twinEdge, oppositeFace, horizon );

					} else {

						// the opposite face can't see the vertex, so this edge is part of the horizon

						horizon.push( edge );

					}

				}

				edge = edge.next;

			} while ( edge !== crossEdge );

			return this;

		}

		/**
		 * Creates a face with the vertices 'eyeVertex.point', 'horizonEdge.tail' and 'horizonEdge.head'
		 * in CCW order. All the half edges are created in CCW order thus the face is always pointing
		 * outside the hull.
		 *
		 * @private
		 * @param {VertexNode} eyeVertex - The vertex that is added to the hull.
		 * @param {HalfEdge} horizonEdge - A single edge of the horizon.
		 * @return {HalfEdge} The half edge whose vertex is the eyeVertex.
		 */
		_addAdjoiningFace( eyeVertex, horizonEdge ) {

			// all the half edges are created in ccw order thus the face is always pointing outside the hull

			const face = Face.create( eyeVertex, horizonEdge.tail(), horizonEdge.head() );

			this.faces.push( face );

			// join face.getEdge( - 1 ) with the horizon's opposite edge face.getEdge( - 1 ) = face.getEdge( 2 )

			face.getEdge( -1 ).setTwin( horizonEdge.twin );

			return face.getEdge( 0 ); // the half edge whose vertex is the eyeVertex


		}

		/**
		 * Adds 'horizon.length' faces to the hull, each face will be linked with the horizon
		 * opposite face and the face on the left/right.
		 *
		 * @private
		 * @param {VertexNode} eyeVertex - The vertex that is added to the hull.
		 * @param {Array<HalfEdge>} horizon - The horizon.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_addNewFaces( eyeVertex, horizon ) {

			this.newFaces = [];

			let firstSideEdge = null;
			let previousSideEdge = null;

			for ( let i = 0; i < horizon.length; i ++ ) {

				const horizonEdge = horizon[ i ];

				// returns the right side edge

				const sideEdge = this._addAdjoiningFace( eyeVertex, horizonEdge );

				if ( firstSideEdge === null ) {

					firstSideEdge = sideEdge;

				} else {

					// joins face.getEdge( 1 ) with previousFace.getEdge( 0 )

					sideEdge.next.setTwin( previousSideEdge );

				}

				this.newFaces.push( sideEdge.face );
				previousSideEdge = sideEdge;

			}

			// perform final join of new faces

			firstSideEdge.next.setTwin( previousSideEdge );

			return this;

		}

		/**
		 * Adds a vertex to the hull with the following algorithm:
		 *
		 * - Compute the 'horizon' which is a chain of half edges. For an edge to belong to this group
		 * it must be the edge connecting a face that can see 'eyeVertex' and a face which cannot see 'eyeVertex'.
		 * - All the faces that can see 'eyeVertex' have its visible vertices removed from the assigned vertex list.
		 * - A new set of faces is created with each edge of the 'horizon' and 'eyeVertex'. Each face is connected
		 * with the opposite horizon face and the face on the left/right.
		 * - The vertices removed from all the visible faces are assigned to the new faces if possible.
		 *
		 * @private
		 * @param {VertexNode} eyeVertex - The vertex to add.
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_addVertexToHull( eyeVertex ) {

			const horizon = [];

			this.unassigned.clear();

			// remove 'eyeVertex' from 'eyeVertex.face' so that it can't be added to the 'unassigned' vertex list

			this._removeVertexFromFace( eyeVertex, eyeVertex.face );

			this._computeHorizon( eyeVertex.point, null, eyeVertex.face, horizon );

			this._addNewFaces( eyeVertex, horizon );

			// reassign 'unassigned' vertices to the new faces

			this._resolveUnassignedPoints( this.newFaces );

			return	this;

		}

		/**
		 * Cleans up internal properties after computing the convex hull.
		 *
		 * @private
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_cleanup() {

			this.assigned.clear();
			this.unassigned.clear();
			this.newFaces = [];

			return this;

		}

		/**
		 * Starts the execution of the quick hull algorithm.
		 *
		 * @private
		 * @return {ConvexHull} A reference to this convex hull.
		 */
		_compute() {

			let vertex;

			this._computeInitialHull();

			// add all available vertices gradually to the hull

			while ( ( vertex = this._nextVertexToAdd() ) !== undefined ) {

				this._addVertexToHull( vertex );

			}

			this._reindexFaces();

			this._cleanup();

			return this;

		}

	}

	/**
	 * Represents a section bounded by a specific amount of half-edges.
	 * The current implementation assumes that a face always consist of three edges.
	 *
	 * @private
	 */
	class Face {

		/**
		 * Constructs a new face.
		 */
		constructor() {

			/**
			 * The normal vector of the face.
			 *
			 * @private
			 * @type {Vector3}
			 */
			this.normal = new three.Vector3();

			/**
			 * The midpoint or centroid of the face.
			 *
			 * @private
			 * @type {Vector3}
			 */
			this.midpoint = new three.Vector3();

			/**
			 * The area of the face.
			 *
			 * @private
			 * @type {number}
			 * @default 0
			 */
			this.area = 0;

			/**
			 * Signed distance from face to the origin.
			 *
			 * @private
			 * @type {number}
			 * @default 0
			 */
			this.constant = 0;

			/**
			 * Reference to a vertex in a vertex list this face can see.
			 *
			 * @private
			 * @type {?VertexNode}
			 * @default null
			 */
			this.outside = null; // reference to a vertex in a vertex list this face can see
			this.mark = Visible;

			/**
			 * Reference to the base edge of a face. To retrieve all edges, you can use the
			 * `next` reference of the current edge.
			 *
			 * @private
			 * @type {?HalfEdge}
			 * @default null
			 */
			this.edge = null;

		}

		/**
		 * Creates a face from the given vertex nodes.
		 *
		 * @private
		 * @param {VertexNode} a - The first vertex node.
		 * @param {VertexNode} b - The second vertex node.
		 * @param {VertexNode} c - The third vertex node.
		 * @return {Face} The created face.
		 */
		static create( a, b, c ) {

			const face = new Face();

			const e0 = new HalfEdge( a, face );
			const e1 = new HalfEdge( b, face );
			const e2 = new HalfEdge( c, face );

			// join edges

			e0.next = e2.prev = e1;
			e1.next = e0.prev = e2;
			e2.next = e1.prev = e0;

			// main half edge reference

			face.edge = e0;

			return face.compute();

		}

		/**
		 * Returns an edge by the given index.
		 *
		 * @private
		 * @param {number} i - The edge index.
		 * @return {HalfEdge} The edge.
		 */
		getEdge( i ) {

			let edge = this.edge;

			while ( i > 0 ) {

				edge = edge.next;
				i --;

			}

			while ( i < 0 ) {

				edge = edge.prev;
				i ++;

			}

			return edge;

		}

		/**
		 * Computes all properties of the face.
		 *
		 * @private
		 * @return {Face} A reference to this face.
		 */
		compute() {

			const a = this.edge.tail();
			const b = this.edge.head();
			const c = this.edge.next.head();

			_triangle.set( a.point, b.point, c.point );

			_triangle.getNormal( this.normal );
			_triangle.getMidpoint( this.midpoint );
			this.area = _triangle.getArea();

			this.constant = this.normal.dot( this.midpoint );

			return this;

		}

		/**
		 * Returns the signed distance from a given point to the plane representation of this face.
		 *
		 * @private
		 * @param {Vector3} point - The point to compute the distance to.
		 * @return {number} The distance.
		 */
		distanceToPoint( point ) {

			return this.normal.dot( point ) - this.constant;

		}

	}

	/**
	 * The basis for a half-edge data structure, also known as doubly
	 * connected edge list (DCEL).
	 *
	 * @private
	 */
	class HalfEdge {

		/**
		 * Constructs a new half edge.
		 *
		 * @param {VertexNode} vertex - A reference to its destination vertex.
		 * @param {Face} face - A reference to its face.
		 */
		constructor( vertex, face ) {

			/**
			 * A reference to its destination vertex.
			 *
			 * @private
			 * @type {VertexNode}
			 */
			this.vertex = vertex;

			/**
			 * Reference to the previous half-edge of the same face.
			 *
			 * @private
			 * @type {?HalfEdge}
			 * @default null
			 */
			this.prev = null;

			/**
			 * Reference to the next half-edge of the same face.
			 *
			 * @private
			 * @type {?HalfEdge}
			 * @default null
			 */
			this.next = null;

			/**
			 * Reference to the twin half-edge to reach the opposite face.
			 *
			 * @private
			 * @type {?HalfEdge}
			 * @default null
			 */
			this.twin = null;

			/**
			 * A reference to its face.
			 *
			 * @private
			 * @type {Face}
			 */
			this.face = face;

		}

		/**
		 * Returns the destination vertex.
		 *
		 * @private
		 * @return {VertexNode} The destination vertex.
		 */
		head() {

			return this.vertex;

		}

		/**
		 * Returns the origin vertex.
		 *
		 * @private
		 * @return {VertexNode} The destination vertex.
		 */
		tail() {

			return this.prev ? this.prev.vertex : null;

		}

		/**
		 * Returns the Euclidean length (straight-line length) of the edge.
		 *
		 * @private
		 * @return {number} The edge's length.
		 */
		length() {

			const head = this.head();
			const tail = this.tail();

			if ( tail !== null ) {

				return tail.point.distanceTo( head.point );

			}

			return -1;

		}

		/**
		 * Returns the square of the Euclidean length (straight-line length) of the edge.
		 *
		 * @private
		 * @return {number} The square of the edge's length.
		 */
		lengthSquared() {

			const head = this.head();
			const tail = this.tail();

			if ( tail !== null ) {

				return tail.point.distanceToSquared( head.point );

			}

			return -1;

		}

		/**
		 * Sets the twin edge of this half-edge. It also ensures that the twin reference
		 * of the given half-edge is correctly set.
		 *
		 * @private
		 * @param {HalfEdge} edge - The twin edge to set.
		 * @return {HalfEdge} A reference to this edge.
		 */
		setTwin( edge ) {

			this.twin = edge;
			edge.twin = this;

			return this;

		}

	}

	/**
	 * A vertex as a double linked list node.
	 *
	 * @private
	 */
	class VertexNode {

		/**
		 * Constructs a new vertex node.
		 *
		 * @param {Vector3} point - A point in 3D space.
		 */
		constructor( point ) {

			/**
			 * A point in 3D space.
			 *
			 * @private
			 * @type {Vector3}
			 */
			this.point = point;

			/**
			 * Reference to the previous vertex in the double linked list.
			 *
			 * @private
			 * @type {?VertexNode}
			 * @default null
			 */
			this.prev = null;

			/**
			 * Reference to the next vertex in the double linked list.
			 *
			 * @private
			 * @type {?VertexNode}
			 * @default null
			 */
			this.next = null;

			/**
			 * Reference to the face that is able to see this vertex.
			 *
			 * @private
			 * @type {?Face}
			 * @default null
			 */
			this.face = null;

		}

	}

	/**
	 * A doubly linked list of vertices.
	 *
	 * @private
	 */
	class VertexList {

		/**
		 * Constructs a new vertex list.
		 */
		constructor() {

			/**
			 * Reference to the first vertex of the linked list.
			 *
			 * @private
			 * @type {?VertexNode}
			 * @default null
			 */
			this.head = null;

			/**
			 * Reference to the last vertex of the linked list.
			 *
			 * @private
			 * @type {?VertexNode}
			 * @default null
			 */
			this.tail = null;

		}

		/**
		 * Returns the head reference.
		 *
		 * @private
		 * @return {VertexNode} The head reference.
		 */
		first() {

			return this.head;

		}

		/**
		 * Returns the tail reference.
		 *
		 * @private
		 * @return {VertexNode} The tail reference.
		 */
		last() {

			return this.tail;

		}

		/**
		 * Clears the linked list.
		 *
		 * @private
		 * @return {VertexList} A reference to this vertex list.
		 */
		clear() {

			this.head = this.tail = null;

			return this;

		}

		/**
		 * Inserts a vertex before a target vertex.
		 *
		 * @private
		 * @param {VertexNode} target - The target.
		 * @param {VertexNode} vertex - The vertex to insert.
		 * @return {VertexList} A reference to this vertex list.
		 */
		insertBefore( target, vertex ) {

			vertex.prev = target.prev;
			vertex.next = target;

			if ( vertex.prev === null ) {

				this.head = vertex;

			} else {

				vertex.prev.next = vertex;

			}

			target.prev = vertex;

			return this;

		}

		/**
		 * Inserts a vertex after a target vertex.
		 *
		 * @private
		 * @param {VertexNode} target - The target.
		 * @param {VertexNode} vertex - The vertex to insert.
		 * @return {VertexList} A reference to this vertex list.
		 */
		insertAfter( target, vertex ) {

			vertex.prev = target;
			vertex.next = target.next;

			if ( vertex.next === null ) {

				this.tail = vertex;

			} else {

				vertex.next.prev = vertex;

			}

			target.next = vertex;

			return this;

		}

		/**
		 * Appends a vertex to this vertex list.
		 *
		 * @private
		 * @param {VertexNode} vertex - The vertex to append.
		 * @return {VertexList} A reference to this vertex list.
		 */
		append( vertex ) {

			if ( this.head === null ) {

				this.head = vertex;

			} else {

				this.tail.next = vertex;

			}

			vertex.prev = this.tail;
			vertex.next = null; // the tail has no subsequent vertex

			this.tail = vertex;

			return this;

		}

		/**
		 * Appends a chain of vertices where the given vertex is the head.
		 *
		 * @private
		 * @param {VertexNode} vertex - The head vertex of a chain of vertices.
		 * @return {VertexList} A reference to this vertex list.
		 */
		appendChain( vertex ) {

			if ( this.head === null ) {

				this.head = vertex;

			} else {

				this.tail.next = vertex;

			}

			vertex.prev = this.tail;

			// ensure that the 'tail' reference points to the last vertex of the chain

			while ( vertex.next !== null ) {

				vertex = vertex.next;

			}

			this.tail = vertex;

			return this;

		}

		/**
		 * Removes a vertex from the linked list.
		 *
		 * @private
		 * @param {VertexNode} vertex - The vertex to remove.
		 * @return {VertexList} A reference to this vertex list.
		 */
		remove( vertex ) {

			if ( vertex.prev === null ) {

				this.head = vertex.next;

			} else {

				vertex.prev.next = vertex.next;

			}

			if ( vertex.next === null ) {

				this.tail = vertex.prev;

			} else {

				vertex.next.prev = vertex.prev;

			}

			return this;

		}

		/**
		 * Removes a sublist of vertices from the linked list.
		 *
		 * @private
		 * @param {VertexNode} a - The head of the sublist.
		 * @param {VertexNode} b - The tail of the sublist.
		 * @return {VertexList} A reference to this vertex list.
		 */
		removeSubList( a, b ) {

			if ( a.prev === null ) {

				this.head = b.next;

			} else {

				a.prev.next = b.next;

			}

			if ( b.next === null ) {

				this.tail = a.prev;

			} else {

				b.next.prev = a.prev;

			}

			return this;

		}

		/**
		 * Returns `true` if the linked list is empty.
		 *
		 * @private
		 * @return {boolean} Whether the linked list is empty or not.
		 */
		isEmpty() {

			return this.head === null;

		}

	}

	/**
	 * This class can be used to generate a convex hull for a given array of 3D points.
	 * The average time complexity for this task is considered to be O(nlog(n)).
	 *
	 * ```js
	 * const geometry = new ConvexGeometry( points );
	 * const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
	 * const mesh = new THREE.Mesh( geometry, material );
	 * scene.add( mesh );
	 * ```
	 *
	 * @augments BufferGeometry
	 * @three_import import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
	 */
	class ConvexGeometry extends three.BufferGeometry {

		/**
		 * Constructs a new convex geometry.
		 *
		 * @param {Array<Vector3>} points - An array of points in 3D space which should be enclosed by the convex hull.
		 */
		constructor( points = [] ) {

			super();

			// buffers

			const vertices = [];
			const normals = [];

			const convexHull = new ConvexHull().setFromPoints( points );

			// generate vertices and normals

			const faces = convexHull.faces;

			for ( let i = 0; i < faces.length; i ++ ) {

				const face = faces[ i ];
				let edge = face.edge;

				// we move along a doubly-connected edge list to access all face points (see HalfEdge docs)

				do {

					const point = edge.head().point;

					vertices.push( point.x, point.y, point.z );
					normals.push( face.normal.x, face.normal.y, face.normal.z );

					edge = edge.next;

				} while ( edge !== face.edge );

			}

			// build geometry

			this.setAttribute( 'position', new three.Float32BufferAttribute( vertices, 3 ) );
			this.setAttribute( 'normal', new three.Float32BufferAttribute( normals, 3 ) );

		}

	}

	/**
	 * An exporter for STL.
	 *
	 * STL files describe only the surface geometry of a three-dimensional object without
	 * any representation of color, texture or other common model attributes. The STL format
	 * specifies both ASCII and binary representations, with binary being more compact.
	 * STL files contain no scale information or indexes, and the units are arbitrary.
	 *
	 * ```js
	 * const exporter = new STLExporter();
	 * const data = exporter.parse( mesh, { binary: true } );
	 * ```
	 *
	 * @three_import import { STLExporter } from 'three/addons/exporters/STLExporter.js';
	 */
	class STLExporter {

		/**
		 * Parses the given 3D object and generates the STL output.
		 *
		 * If the 3D object is composed of multiple children and geometry, they are merged into a single mesh in the file.
		 *
		 * @param {Object3D} scene - A scene, mesh or any other 3D object containing meshes to encode.
		 * @param {STLExporter~Options} options - The export options.
		 * @return {string|ArrayBuffer} The exported STL.
		 */
		parse( scene, options = {} ) {

			options = Object.assign( {
				binary: false
			}, options );

			const binary = options.binary;

			//

			const objects = [];
			let triangles = 0;

			scene.traverse( function ( object ) {

				if ( object.isMesh ) {

					const geometry = object.geometry;

					const index = geometry.index;
					const positionAttribute = geometry.getAttribute( 'position' );

					triangles += ( index !== null ) ? ( index.count / 3 ) : ( positionAttribute.count / 3 );

					objects.push( {
						object3d: object,
						geometry: geometry
					} );

				}

			} );

			let output;
			let offset = 80; // skip header

			if ( binary === true ) {

				const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4;
				const arrayBuffer = new ArrayBuffer( bufferLength );
				output = new DataView( arrayBuffer );
				output.setUint32( offset, triangles, true ); offset += 4;

			} else {

				output = '';
				output += 'solid exported\n';

			}

			const vA = new three.Vector3();
			const vB = new three.Vector3();
			const vC = new three.Vector3();
			const cb = new three.Vector3();
			const ab = new three.Vector3();
			const normal = new three.Vector3();

			for ( let i = 0, il = objects.length; i < il; i ++ ) {

				const object = objects[ i ].object3d;
				const geometry = objects[ i ].geometry;

				const index = geometry.index;
				const positionAttribute = geometry.getAttribute( 'position' );

				if ( index !== null ) {

					// indexed geometry

					for ( let j = 0; j < index.count; j += 3 ) {

						const a = index.getX( j + 0 );
						const b = index.getX( j + 1 );
						const c = index.getX( j + 2 );

						writeFace( a, b, c, positionAttribute, object );

					}

				} else {

					// non-indexed geometry

					for ( let j = 0; j < positionAttribute.count; j += 3 ) {

						const a = j + 0;
						const b = j + 1;
						const c = j + 2;

						writeFace( a, b, c, positionAttribute, object );

					}

				}

			}

			if ( binary === false ) {

				output += 'endsolid exported\n';

			}

			return output;

			function writeFace( a, b, c, positionAttribute, object ) {

				vA.fromBufferAttribute( positionAttribute, a );
				vB.fromBufferAttribute( positionAttribute, b );
				vC.fromBufferAttribute( positionAttribute, c );

				if ( object.isSkinnedMesh === true ) {

					object.applyBoneTransform( a, vA );
					object.applyBoneTransform( b, vB );
					object.applyBoneTransform( c, vC );

				}

				vA.applyMatrix4( object.matrixWorld );
				vB.applyMatrix4( object.matrixWorld );
				vC.applyMatrix4( object.matrixWorld );

				writeNormal( vA, vB, vC );

				writeVertex( vA );
				writeVertex( vB );
				writeVertex( vC );

				if ( binary === true ) {

					output.setUint16( offset, 0, true ); offset += 2;

				} else {

					output += '\t\tendloop\n';
					output += '\tendfacet\n';

				}

			}

			function writeNormal( vA, vB, vC ) {

				cb.subVectors( vC, vB );
				ab.subVectors( vA, vB );
				cb.cross( ab ).normalize();

				normal.copy( cb ).normalize();

				if ( binary === true ) {

					output.setFloat32( offset, normal.x, true ); offset += 4;
					output.setFloat32( offset, normal.y, true ); offset += 4;
					output.setFloat32( offset, normal.z, true ); offset += 4;

				} else {

					output += '\tfacet normal ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';
					output += '\t\touter loop\n';

				}

			}

			function writeVertex( vertex ) {

				if ( binary === true ) {

					output.setFloat32( offset, vertex.x, true ); offset += 4;
					output.setFloat32( offset, vertex.y, true ); offset += 4;
					output.setFloat32( offset, vertex.z, true ); offset += 4;

				} else {

					output += '\t\t\tvertex ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

				}

			}

		}

	}

	function attachExtras (THREEGlobal) {
	    return {
	        ...THREEGlobal,
	        FontLoader,
	        TextGeometry,
	        OrbitControls,
	        ConvexGeometry,
	        STLExporter,
	    };
	}

	if (typeof window !== 'undefined' && window.THREE) {
	    window.THREE = attachExtras(window.THREE);
	}

	return attachExtras;

}));
