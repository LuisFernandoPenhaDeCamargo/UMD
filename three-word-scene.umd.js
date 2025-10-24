(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three', 'three-csg-ts'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('three'), require('three-csg-ts'));
    } else {
        root.ThreeWordScene = factory(root.THREE, root.ThreeCSG);
    }
}(typeof self !== 'undefined' ? self: this, function (THREE, ThreeCSG) {
    function ThreeWordScene(container, { leftSidedText, rightSidedText }) {
        if (!container) {
            console.error("Container inválido");

            return;
        }

        const SPACING_BETWEEN_CHARACTERS = 15;
        const SCALE_FACTOR = 0.09;
        const HEIGHT_BASE = 1.5 * SCALE_FACTOR;
        const WIDTH_BASE = 15 * SCALE_FACTOR;
        const DEBUG = false;

        // Funções auxiliares
        function padWord(word, lengthDifference, fillChar) {
            const leftPadSize = Math.floor(lengthDifference / 2) + word.length;
            const rightPadSize = leftPadSize + Math.ceil(lengthDifference / 2);

            return word.padStart(leftPadSize, fillChar).padEnd(rightPadSize, fillChar);
        }

        function nomalizeData(leftSidedText, rightSidedText, fillChar) {
            leftSidedText = leftSidedText.toUpperCase();
            rightSidedText = rightSidedText.toUpperCase();

            const lengthDifference = Math.abs(leftSidedText.length - rightSidedText.length);
            if (leftSidedText.length > rightSidedText.length) {
                rightSidedText = padWord(rightSidedText, lengthDifference, fillChar);
            } else if (rightSidedText.length > leftSidedText.length) {
                leftSidedText = padWord(leftSidedText, lengthDifference, fillChar);
            }

            return { normalizedLeftSidedText: leftSidedText, normalizedRightSidedText: rightSidedText, };
        }

        /**
        * Gera a interseção de duas letras (como A e B).
        * @param {THREE.Font} font - fonte carregada pelo FontLoader
        * @param {string} leftSidedLetter - letra da esquerda
        * @param {string} rightSidedLetter - letra da direita
        * @returns {THREE.Mesh} Mesh resultante da interseção
        */
        function dualLetter(font, leftSidedLetter, rightSidedLetter) {
            // Dependendo da geometria, o pivot point muda, em cilindros, é o centro deles; em TextGeometry, é o vértice inferior traseiro.
            const leftSidedGeometry = new THREE.TextGeometry(leftSidedLetter, {
                font: font,
                size: 1,
                height: 1,
                depth: 3,
            });
            const rightSidedGeometry = new THREE.TextGeometry(rightSidedLetter, {
                font: font,
                size: 1,
                height: 1,
                depth: 3,
            });
            /* Existem outros tipos de materiais como o MeshStandardMaterial que possui as propriedades:
            - color: 0xDDDDDD // Cinza claro
            - metalness: 0.6 // Efeito metálico
            - roughness: 0.4 // Controla o brilho
            por exemplo*/
            const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, });
            const leftSidedMesh = new THREE.Mesh(leftSidedGeometry, material);
            const rightSidedMesh = new THREE.Mesh(rightSidedGeometry, material);

            leftSidedMesh.rotation.y = Math.PI / 4;
            rightSidedMesh.position.x = 2;
            rightSidedMesh.rotation.y = -Math.PI / 4;

            leftSidedMesh.updateMatrix();
            rightSidedMesh.updateMatrix();

            if (DEBUG) {
                const group = new THREE.Group();

                group.add(leftSidedMesh);
                group.add(rightSidedMesh);

                return group
            }

            const leftSidedCsg = ThreeCSG.CSG.fromMesh(leftSidedMesh);
            const rightSidedCsg = ThreeCSG.CSG.fromMesh(rightSidedMesh);
            const resultCsg = rightSidedCsg.intersect(leftSidedCsg);
            /* Matrix: a matriz de transformação que será aplicada à geometria resultante, geralmente é a matrix do mesh de referência que você quer manter a 
            posição/rotação/escala original */
            /* Passar `new THREE.Matrix4()` garante que o sistema de coordenadas do resultado seja o cru da operação booleana, sem herdar position/rotation/scale 
            de nenhum dos meshs de entrada; mas mesmo sem herdar, o espaço local da geometria resultante não é garantidamente centralizado em sua box. Por exemplo:
            - Um cubo gerado com Three.js com `BoxGeometry` vem com vértices em torno de (0, 0, 0), ou seja, centrado
            - Já um operação CSG entre duas letras pode gerar um volume deslocado em relação à origem local
            Ou seja, o mesh final está no (0, 0, 0) como objeto, mas os vértices dentro da `geometry`, podem não estar*/
            const resultMesh = ThreeCSG.CSG.toMesh(resultCsg, /*rightSidedMesh.matrix*/ new THREE.Matrix4(), material);

            // Cálcula o centro geométrico da malha resultante.
            resultMesh.geometry.computeBoundingBox();

            const bbox = resultMesh.geometry.boundingBox;
            const offset = bbox.getCenter(new THREE.Vector3()).negate();

            /* Os cilindros estão com o vértice na origem; para que a interseção das letras se mova de modo que o centro do cilindro coincida com o centro 
            da intersecção (na base XZ), você utiliza os offsets. Se você fizesse `resultMesh.geometry.translate(0, 0, 0);`, as letras não iriam estar 
            alinhadas com os cilindros */
            // Corrige o espaço local da geometria, para que o CENTRO fique no (0, 0, 0)
            resultMesh.geometry.translate(offset.x, HEIGHT_BASE, offset.z);

            return resultMesh;
        }

        function xOffset(index, totalLength) {
            const offsetCentral = (totalLength * SPACING_BETWEEN_CHARACTERS + SPACING_BETWEEN_CHARACTERS) / 2;
            const offset = ((index + 0.5) * SPACING_BETWEEN_CHARACTERS - offsetCentral) * SCALE_FACTOR;

            return offset;
        }

        /**
        * Cria uma palavra inteira usando a função dualLetter para cada par
        * @param {THREE.Font} font - fonte carregada
        * @param {string} leftSidedText - primeira palavra
        * @param {string} rightSidedText - segunda palavra
        * @returns {THREE.Group} Grupo com todas as letras combinadas
        */
        function createWord(font, leftSidedText, rightSidedText) {
            const length = leftSidedText.length;
            const group = new THREE.Group();

            for (let index = 0; index < length; index++) {
                const mesh = dualLetter(font, leftSidedText[index], rightSidedText[index]);
                const positionX = xOffset(index, length);

                mesh.position.set(positionX, 0, 0);
                group.add(mesh);
            }

            return group;
        }

        function createBase(totalLength, widthBase, heightBase) {
            const group = new THREE.Group();
            const points = [];

            for (let index = 0; index < totalLength; index++) {
                const positionX = xOffset(index, totalLength);
                /* `32` é o número de segmentos radiais do cilindro, ou seja, quantos polígonos vão formar a circuferência do cilindro (32 lados). Quanto maior 
                o número, mais "liso" será o cilindro; quanto menor, mais "facetado" ou "poligonal" ele vai parecer*/
                const cylinder = new THREE.CylinderGeometry(widthBase / 2, widthBase / 2, heightBase, 32);
                const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, });
                const mesh = new THREE.Mesh(cylinder, material);

                mesh.position.set(positionX, heightBase / 2, 0); // Altura / 2 para encostar no "chão"
                group.add(mesh);

                if (index === 0 || index === totalLength - 1) {
                    points.push(new THREE.Vector3(positionX, heightBase, widthBase / 2));
                    points.push(new THREE.Vector3(positionX, 0, widthBase / 2));
                    points.push(new THREE.Vector3(positionX, heightBase, -widthBase / 2));
                    points.push(new THREE.Vector3(positionX, 0, -widthBase / 2));
                }
            }

            const baseGeometry = new THREE.ConvexGeometry(points);
            const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, });
            const baseMesh = new THREE.Mesh(baseGeometry, material)

            group.add(baseMesh);

            return group;
        }

        function frameObjectToCamera(camera, object, margin = 1.2) {
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center2 = box.getCenter(new THREE.Vector3());

            // Fator de margem (1.2 = 20% de espaço extra)
            const maxDim = Math.max(size.x, size.y, size.z) * margin;

            // Converter FOV em radianos
            const fov = (camera.fov * Math.PI) / 180;

            // Calcular a distância ideal da câmera para que o objeto caiba verticalmente no frustum
            const distance = maxDim / (2 * Math.tan(fov / 2));

            // Atualizar posição da câmera e controles
            camera.position.set(center2.x, center2.y, distance);
            camera.lookAt(center2);

            if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();

            return { box, center2, distance };
        }

        const scene = new THREE.Scene();

        scene.background = new THREE.Color(0xffffff);

        // - Precisa se tornar reativo
        // - Não está centralizado
        // - Verificar especificações, o que eu vou permitir rotar, por exemplo
        //const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const aspect = container.clientWidth / container.clientHeight;
        // - A câmera está **olhando para ponto (0, 0, 0)** por padrão,
        // - A câmera está em (x: 0, y: 0, z: 100).
        const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

        camera.position.z = 100;

        const renderer = new THREE.WebGLRenderer({ antialias: true, });

        //renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        container.appendChild(renderer.domElement); // Colocar dentro do container
        console.log('Container size:', container.clientWidth, container.clientHeight);
        console.log('Renderer canvas size:', renderer.domElement.width, renderer.domElement.height);
        console.log('Camera position:', camera.position);


        const controls = new THREE.OrbitControls(camera, renderer.domElement);

        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 2;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.minDistance = 2;
        controls.maxDistance = 10;

        const light = new THREE.DirectionalLight(0xffffff, 1);

        light.position.set(0, 1, 1).normalize();
        scene.add(light);

        const loader = new THREE.FontLoader();

        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
            const { normalizedLeftSidedText, normalizedRightSidedText } = nomalizeData(leftSidedText, rightSidedText, 'X');
            const wordMesh = createWord(font, normalizedLeftSidedText, normalizedRightSidedText);
            const box = new THREE.Box3().setFromObject(wordMesh);
            const center = box.getCenter(new THREE.Vector3());

            const { center2, distance } = frameObjectToCamera(camera, wordMesh);
            console.log('📏 Camera auto-framed', { center2, distance });

            controls.target.copy(center);
            controls.update();

            const baseMesh = createBase(normalizedLeftSidedText.length, WIDTH_BASE, HEIGHT_BASE);

            scene.add(wordMesh);
            scene.add(baseMesh);

            console.groupCollapsed('🔍 Scene Diagnostics');
            console.log('📦 Container size:', container.clientWidth, container.clientHeight);
            console.log('🎥 Camera position:', camera.position);
            console.log('🎯 Controls target:', controls.target);
            console.log('🔡 WordMesh center:', center);
            //console.log('📏 WordMesh size:', size);
            const vFOV = THREE.MathUtils.degToRad(camera.fov); // campo de visão vertical em radianos
            const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
            const width = height * camera.aspect;

            console.log('📐 Camera viewport world-space:', { width, height });

            function animate() {
                requestAnimationFrame(animate); // garante loop contínuo
                controls.update();
                renderer.render(scene, camera);
            }

            animate();
        });
    }

    return ThreeWordScene;
}));

/*
p:40 <link rel=preload> has an invalid `href` value
p:522 ✅ 96 Hello World - script carregado e DOM pronto!
p:284 🧭 Container encontrado.
p:284 🧭 Container encontrado.
p:274 ✅ Container encontrado na verificação inicial.
p:329 🎨 Botão clicado: FUCSIA
p:505 ✍️ Input text container atualizado: <div class=​"main-product-customization text-left" data-scene-injected=​"true">​…​</div>​<div class=​"-title">​ Personalizar produto ​</div>​<div class=​"customization">​…​</div>​<label for=​"customization-26367">​…​</label>​<input type=​"text" placeholder=​"Digite aqui..." maxlength=​"11" class data-listener-added=​"true">​<!----><div class=​"flex -between">​…​</div>​flex</div>​<div class=​"customization">​…​</div>​<label for=​"customization-26369">​…​</label>​<input type=​"text" placeholder=​"Digite aqui..." maxlength=​"11" class data-listener-added=​"true">​<!----><div class=​"flex -between">​…​</div>​flex</div>​<!----><div class=​"three-scene-wrapper" data-injected-at=​"1761319478054">​…​</div>​flex</div>​
p:513 🧭 Container encontrado, injetando cena...
p:391 🎬 Injetando cena 3D...
p:460 ✅ Inicializando ThreeWordScene...
three-word-scene.umd.js:201 Container size: 290 320
three-word-scene.umd.js:202 Renderer canvas size: 290 320
three-word-scene.umd.js:203 Camera position: Vector3 {x: 0, y: 0, z: 100}
p:498 🎨 Cena 3D injetada e pronta (responsiva).
p:505 ✍️ Input text container atualizado: <div class=​"main-product-customization text-left" data-scene-injected=​"true">​…​</div>​
three-word-scene.umd.js:237 🔍 Scene Diagnostics
three-word-scene.umd.js:238 📦 Container size: 290 320
three-word-scene.umd.js:239 🎥 Camera position: Vector3 {x: -0.6622335782879075, y: 0.5773530596100958, z: 9.999523563868552}
three-word-scene.umd.js:240 🎯 Controls target: Vector3 {x: -0.7358111917972562, y: 0.6415000036358833, z: 0}
three-word-scene.umd.js:241 🔡 WordMesh center: Vector3 {x: -0.7358111917972563, y: 0.6415000036358833, z: 0}
three-word-scene.umd.js:247 📐 Camera viewport world-space: {width: 13.90713903919681, height: 15.345808594975791}height: 15.345808594975791width: 13.90713903919681[[Prototype]]: Object
p:1 The resource https://king-assets.yampi.me/dooki/68f12d70a4038/68f12d70a403b.jpeg was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.

---

p:40 <link rel=preload> has an invalid `href` value
p:522 ✅ 96 Hello World - script carregado e DOM pronto!
p:284 🧭 Container encontrado.
p:284 🧭 Container encontrado.
p:274 ✅ Container encontrado na verificação inicial.
p:329 🎨 Botão clicado: FUCSIA
p:505 ✍️ Input text container atualizado: <div class=​"main-product-customization text-left" data-scene-injected=​"true">​…​</div>​<div class=​"-title">​ Personalizar produto ​</div>​<div class=​"customization">​…​</div>​<label for=​"customization-26367">​…​</label>​<input type=​"text" placeholder=​"Digite aqui..." maxlength=​"11" class data-listener-added=​"true">​<!----><div class=​"flex -between">​…​</div>​flex</div>​<div class=​"customization">​…​</div>​<label for=​"customization-26369">​…​</label>​<input type=​"text" placeholder=​"Digite aqui..." maxlength=​"11" class data-listener-added=​"true">​<!----><div class=​"flex -between">​…​</div>​flex</div>​<!----><div class=​"three-scene-wrapper" data-injected-at=​"1761319499462">​…​</div>​flex</div>​
p:513 🧭 Container encontrado, injetando cena...
p:391 🎬 Injetando cena 3D...
p:460 ✅ Inicializando ThreeWordScene...
three-word-scene.umd.js:201 Container size: 396 400
three-word-scene.umd.js:202 Renderer canvas size: 396 400
three-word-scene.umd.js:203 Camera position: Vector3 {x: 0, y: 0, z: 100}
p:498 🎨 Cena 3D injetada e pronta (responsiva).
p:505 ✍️ Input text container atualizado: <div class=​"main-product-customization text-left" data-scene-injected=​"true">​…​</div>​
three-word-scene.umd.js:237 🔍 Scene Diagnostics
three-word-scene.umd.js:238 📦 Container size: 396 400
three-word-scene.umd.js:239 🎥 Camera position: Vector3 {x: -0.6622335782879075, y: 0.5773530596100958, z: 9.999523563868552}
three-word-scene.umd.js:240 🎯 Controls target: Vector3 {x: -0.7358111917972562, y: 0.6415000036358833, z: 0}
three-word-scene.umd.js:241 🔡 WordMesh center: Vector3 {x: -0.7358111917972563, y: 0.6415000036358833, z: 0}
three-word-scene.umd.js:247 📐 Camera viewport world-space: {width: 15.192350509026033, height: 15.345808594975791}

*/