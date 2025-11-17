(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three', 'three-csg-ts'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('three'), require('three-csg-ts'));
    } else {
        root.ThreeWordScene = factory(root.THREE, root.ThreeCSG);
    }
}(typeof self !== 'undefined' ? self: this, function (THREE, ThreeCSG) {
    async function ThreeWordScene(container, { leftSidedText, rightSidedText }) {
        const state = {
            wordMesh: null,
            baseMesh: null,
        };

        /**
         * Exporta a cena atual (wordMesh + baseMesh) como um arquivo STL.
         */
        function exportStl() {
            try {
                if (!state.wordMesh && !state.baseMesh) throw new Error('⚠️ No mesh to export');

                const exporter = new THREE.STLExporter();
                const group = new THREE.Group();

                if (state.wordMesh) group.add(state.wordMesh);
                if (state.baseMesh) group.add(state.baseMesh);

                const stlString = exporter.parse(group);
                const blob = new Blob([stlString], { type: 'application/vnd.ms-pki.stl' });
                const link = document.createElement('a');

                link.href = URL.createObjectURL(blob);
                link.download = 'dual-word-scene.stl';
                link.click();

                URL.revokeObjectURL(link.href);
            } catch (error) {
                console.error('Erro ao exportar STL:', error);

                alert('⚠️ Falha ao exportar o STL. Veja o console para mais detalhes.');
            }
        }

        if (!container) {
            console.error("Container inválido");

            return;
        }

        const SPACING_BETWEEN_CHARACTERS = 15;
        // múltipliquei tudo por 10, basicamente
        // HOLY CRAP, AUMENTAR O ESPAÇAMENTO
        // R (ROTATE) <EIXO> Y 90
        // G <EIXO> Z 1
        // ABCDEFGHIJK
        // PQRSTUVXWYZ
        const SCALE_FACTOR = 0.09;
        // const SCALE_FACTOR = 1.08;
        const HEIGHT_BASE = 1.5 * SCALE_FACTOR * 10;
        const WIDTH_BASE = 15 * SCALE_FACTOR * 10;
        const MESH_DEBUG = false;
        const VIEWPORT_CANVAS_DEBUG = false;
        const CENTER_AXES_DEBUG = false;

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
            // Ajustar a escala
            const HEART_SCALE = 1.196 * 10;
            const leftSize = leftSidedLetter === '♥' ? HEART_SCALE : 1 * 10;
            const rightSize =  rightSidedLetter === '♥' ? HEART_SCALE : 1 * 10;

            // Dependendo da geometria, o pivot point muda, em cilindros, é o centro deles; em TextGeometry, é o vértice inferior traseiro.
            const leftSidedGeometry = new THREE.TextGeometry(leftSidedLetter, {
                font: font,
                size: leftSize,
                height: 1,
                depth: 3 * 10,
            });
            const rightSidedGeometry = new THREE.TextGeometry(rightSidedLetter, {
                font: font,
                size: rightSize,
                height: 1,
                depth: 3 * 10,
            });
            /* Existem outros tipos de materiais como o MeshStandardMaterial que possui as propriedades:
            - color: 0xDDDDDD // Cinza claro
            - metalness: 0.6 // Efeito metálico
            - roughness: 0.4 // Controla o brilho
            por exemplo*/
            const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, }); // FLAG
            // const material = new THREE.MeshStandardMaterial({
            //     color: 0x444444,
            //     metalness: 0.25,
            //     roughness: 0.55,
            // });
            const leftSidedMesh = new THREE.Mesh(leftSidedGeometry, material);
            const rightSidedMesh = new THREE.Mesh(rightSidedGeometry, material);

            leftSidedMesh.rotation.y = Math.PI / 4;
            // FLAG
            // rightSidedMesh.position.x = 2;
            rightSidedMesh.position.x = 20;
            rightSidedMesh.rotation.y = -Math.PI / 4;

            leftSidedMesh.updateMatrix();
            rightSidedMesh.updateMatrix();

            if (MESH_DEBUG) {
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
            // const offset = ((index + 0.5) * SPACING_BETWEEN_CHARACTERS - offsetCentral) * SCALE_FACTOR; FLAG
            const offset = ((index + 0.5) * SPACING_BETWEEN_CHARACTERS - offsetCentral) * 1;

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
                const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, }); // FLAG
                // const material = new THREE.MeshStandardMaterial({
                //     color: 0x444444,
                //     metalness: 0.25,
                //     roughness: 0.55,
                // });
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
            const material = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, }); // FLAG
            //const material = new THREE.MeshStandardMaterial({
            //    color: 0x444444,
            //    metalness: 0.25,
            //    roughness: 0.55,
            //});
            const baseMesh = new THREE.Mesh(baseGeometry, material)

            group.add(baseMesh);

            return group;
        }

        function onFontLoaded(font, leftSidedText, rightSidedText) {
            const { normalizedLeftSidedText, normalizedRightSidedText } = nomalizeData(leftSidedText, rightSidedText, '♥');
            const wordMesh = createWord(font, normalizedLeftSidedText, normalizedRightSidedText);

            return { normalizedLeftSidedText, wordMesh, };
        }

        async function createWordMesh({ leftSidedText, rightSidedText, }) {
            const loader = new THREE.FontLoader();

            // Retorna uma Promise para carregar fonte e criar mesh.
            return new Promise((resolve) => {
                    loader.load('https://luisfernandopenhadecamargo.github.io/UMD/LiberationMono-Bold-Heart.typeface.json', (font) => {
                    const { normalizedLeftSidedText, wordMesh, } = onFontLoaded(font, leftSidedText, rightSidedText);

                    resolve({ normalizedLeftSidedText, wordMesh, });
                });
            });
        }

        function setupScene(container) {
            const scene = new THREE.Scene();

            scene.background = new THREE.Color(VIEWPORT_CANVAS_DEBUG ? 0o000000 : 0xffffff);

            const aspect = container.clientWidth / container.clientHeight;
            // const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
            const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 2000);

            camera.position.z = 100; // FLAG

            const renderer = new THREE.WebGLRenderer({ antialias: true, });

            renderer.setSize(container.clientWidth, container.clientHeight, false);

            if (!VIEWPORT_CANVAS_DEBUG) {
                renderer.setPixelRatio(window.devicePixelRatio || 1);
            }

            //console.log('window.devicePixelRatio:', window.devicePixelRatio);

            container.appendChild(renderer.domElement); // Colocar dentro do container

            const controls = new THREE.OrbitControls(camera, renderer.domElement);

            controls.enableDamping = true;
            controls.dampingFactor = 0.1;
            controls.rotateSpeed = 2;
            controls.zoomSpeed = 1.2;
            controls.panSpeed = 0.8;
            // controls.minDistance = 2; FLAG
            // controls.maxDistance = 10; FLAG

            const light = new THREE.DirectionalLight(0xffffff, 1);

            light.position.set(0, 1, 1).normalize();
            scene.add(light);

            return { scene, camera, renderer, controls, };
        }

        let centerOfTheMesh = new THREE.Vector3();
        let orbitRadius = 0;
        let orbitHeight = 0;


        async function initialMesh({ leftSidedText, rightSidedText, controls, }) {
            const { normalizedLeftSidedText, wordMesh, } = await createWordMesh({ leftSidedText, rightSidedText, });
            // Centraliza a câmera no centro do mesh.
            const box = new THREE.Box3().setFromObject(wordMesh); // <- Flag
            const centerOfTheMesh = box.getCenter(new THREE.Vector3());

            controls.target.copy(centerOfTheMesh);
            controls.update();

            const size = box.getSize(new THREE.Vector3());

            // camera.position.copy(centerOfTheMesh);

            // Distância ideal é o maior eixo * fator.
            const maxDim = Math.max(size.x, size.y, size.z);

            // const SAFE_FACTOR = 1.25;
            const SAFE_FACTOR = 2;
            const fovInRadians = (camera.fov * Math.PI) / 180;
            const idealDistance = (maxDim * SAFE_FACTOR) / Math.sin(fovInRadians);

            const scrollFactor = 0.55;
            const radius = maxDim * (1.8 - scrollFactor); // Antes era 1.4 - muito longe.
            // const orbitRadius = maxDim * 1.1;
            // Ângulo inicial (45 graus ou -45 graus).
            // const angle = Math.PI / 4; // ou Math.PI / 4 para a outra palavra.
            // const angle = THREE.MathUtils.degToRad(37);
            const angle = THREE.MathUtils.degToRad(45);

            // Armazena para animação
// orbitRadius = radius;
orbitRadius = idealDistance;
orbitHeight = size.y * 0.35;
centerOfTheMesh.copy(centerOfTheMesh);

// Posição inicial da câmera
camera.position.x = centerOfTheMesh.x + Math.sin(angle) * idealDistance;
camera.position.z = centerOfTheMesh.z + Math.cos(angle) * idealDistance;
camera.position.y = centerOfTheMesh.y + orbitHeight;

// Ajuste lateral
camera.position.x -= size.x * 0.10;

camera.lookAt(centerOfTheMesh);


            const baseMesh = createBase(normalizedLeftSidedText.length, WIDTH_BASE, HEIGHT_BASE);

            camera.fov = 22;
            camera.updateProjectionMatrix();

// Ficou amazing, mas a luz precisa se 
//            // Remove luz anterior se existir.
//            scene.children = scene.children.filter(obj => !(obj instanceof THREE.Light));
//
//            // Luz principal - forte e diagonal.
//            const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
//
//            keyLight.position.set(2, 4, 3); // Lado direito + acima + frontal.
//            scene.add(keyLight);
//
//            // Luz de preenchimento.
//            const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
//
//            fillLight.position.set(-3, 2, -2);
//            scene.add(fillLight);
//
//            // Luz ambiente suave para abrir sombra.
//            const ambient = new THREE.AmbientLight(0xffffff, 0.3);
//
//            scene.add(ambient);

            if (CENTER_AXES_DEBUG) {
                const originMarker = new THREE.AxesHelper(2);

                scene.add(originMarker);

                // Marcador do centro do volume.
                const centerMarker = new THREE.Mesh(
                    new THREE.SphereGeometry(0.2),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );

                centerMarker.position.copy(center);
                scene.add(centerMarker);
            }

            scene.add(wordMesh);
            scene.add(baseMesh);

            return { wordMesh, baseMesh, };
        }

        // Criar uma função só para centralizar a malha.
        async function updateMesh({ scene, leftSidedText, rightSidedText, controls, }) {
            // Remove a malha antiga.
            if (state.wordMesh) scene.remove(state.wordMesh);
            if (state.baseMesh) scene.remove(state.baseMesh);

            // Cria nova malha.
            const { normalizedLeftSidedText, wordMesh: newWordMesh, } = await createWordMesh({ leftSidedText, rightSidedText, });
            // Centraliza a malha.
            const box = new THREE.Box3().setFromObject(newWordMesh);
            const centerOfTheMesh = box.getCenter(new THREE.Vector3());

            controls.target.copy(centerOfTheMesh);
            controls.update();

            const newBaseMesh = createBase(normalizedLeftSidedText.length, WIDTH_BASE, HEIGHT_BASE);

            scene.add(newWordMesh);
            scene.add(newBaseMesh);
            state.wordMesh = newWordMesh;
            state.baseMesh = newBaseMesh;
        }

const angleA = -Math.PI / 4; 
const angleB =  Math.PI / 4;

let t = 0;

function animate({ controls, renderer, scene, camera }) {
    t += 0.01;

    const s = (Math.sin(t) + 1) / 2; // 0 → 1 → 0
    const angle = angleA * (1 - s) + angleB * s;

    // Gira ao redor do centro real
    camera.position.x = centerOfTheMesh.x + Math.sin(angle) * orbitRadius;
    camera.position.z = centerOfTheMesh.z + Math.cos(angle) * orbitRadius;
    camera.position.y = centerOfTheMesh.y + orbitHeight;

    camera.lookAt(centerOfTheMesh);

    requestAnimationFrame(() => animate({ controls, renderer, scene, camera }));
    controls.update();
    renderer.render(scene, camera);
}


        const { scene, camera, renderer, controls, } = setupScene(container);
        let { wordMesh, baseMesh, } = await initialMesh({ leftSidedText, rightSidedText, controls, });

        state.wordMesh = wordMesh;
        state.baseMesh = baseMesh;

        animate({ scene, camera, renderer, controls, });

        // console.log("✅ Returning scene instance");

        // Retorna objetos e funções que podem ser usados fora.
        return {
            updateMesh: async (leftSidedText, rightSidedText) => await updateMesh({ scene, leftSidedText, rightSidedText, controls, }),
            exportStl,
        };
    }

    return ThreeWordScene;
}));