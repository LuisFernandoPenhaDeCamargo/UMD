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

        const scene = new THREE.Scene();

        scene.background = new THREE.Color(0xffffff);

        // Tornar isso reativo depois?
        //const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const aspect = container.clientWidth / container.clientHeight;
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

            controls.target.copy(center);
            controls.update();

            const baseMesh = createBase(normalizedLeftSidedText.length, WIDTH_BASE, HEIGHT_BASE);

            scene.add(wordMesh);
            scene.add(baseMesh);

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