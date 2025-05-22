// scripts/main.js

let scene, camera, renderer;
let vrButton;
let controller1, controller2;
let room;
let playerRig; 

// För rörelse och rotation
let clock;
const movementSpeed = 2.0;
const rotationSpeed = 0.7; 

let rightStickController = null;
let leftStickController = null;

const snapTurnAngle = THREE.MathUtils.degToRad(30); 
const snapTurnThreshold = 0.7; 
const snapTurnCooldown = 0.3;  
let lastSnapTurnTime = 0;
let leftStickWasCentered = true;

// **KORRIGERING: Definiera playerRadius globalt HÄR**
const playerRadius = 0.3; // Spelarens ungefärliga "radie" för kollision, i meter.
let roomBoundaries = {}; // Definieras här, populeras i init()

function checkXR() {
    console.log("checkXR function called");
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            if (supported) {
                document.getElementById('enterVR').innerText = "Starta Galleri";
                document.getElementById('enterVR').style.display = 'block';
                vrButton = document.getElementById('enterVR');
                vrButton.addEventListener('click', startVR);
            } else {
                console.log("immersive-vr NOT supported");
                document.getElementById('info').innerHTML = '<h1>VR stöds inte</h1><p>Din webbläsare eller enhet stöder inte immersive-vr.</p>';
            }
        }).catch((error) => {
            console.error("Error calling isSessionSupported for VR:", error);
            document.getElementById('info').innerHTML = '<h1>Fel vid VR-kontroll</h1><p>Kunde inte verifiera VR-stöd.</p>';
        });
    } else {
        console.log("navigator.xr NOT found");
        document.getElementById('info').innerHTML = '<h1>WebXR stöds inte</h1><p>Din webbläsare saknar WebXR-funktioner.</p>';
    }
}

function init() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();

    const textureLoader = new THREE.TextureLoader();
    try {
        const skyTexture = textureLoader.load('images/sky_dome_equirectangular.jpg', 
        () => { 
            skyTexture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = skyTexture; 
            scene.environment = skyTexture; 
            console.log("Himmelstextur laddad och applicerad.");
        }, 
        undefined, 
        (err) => {
            console.error("Kunde inte ladda himmelstextur ('images/sky_dome_equirectangular.jpg'), använder fallback-färg.", err);
            scene.background = new THREE.Color(0x87CEEB); 
        });
    } catch (e) {
        console.error("Generellt fel vid texturladdning för himmel:", e);
        scene.background = new THREE.Color(0x87CEEB); 
    }
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    playerRig = new THREE.Group();
// Prova ett av dessa värden, ett i taget:
playerRig.position.set(0, 0.3, 0); // Känn dig väldigt kort, bänken bör vara i brösthöjd.
// playerRig.position.set(0, 0, 0);   // Din vy är nu direkt på det virtuella golvet.
console.log("PlayerRig initial Y position satt till:", playerRig.position.y);
playerRig.rotation.y = Math.PI;    
playerRig.add(camera);             
scene.add(playerRig);            

    renderer = new THREE.WebGLRenderer({ antialias: true }); 
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; 

    document.getElementById('container').appendChild(renderer.domElement);

    room = new Room(scene); 
    room.create();

    // Definiera rumsgränserna efter att rummet har skapats
    // playerRadius är nu definierad globalt ovanför denna funktion
    if (room && room.roomSize) {
        roomBoundaries = {
            minX: -room.roomSize.width + playerRadius,
            maxX: room.roomSize.width - playerRadius,
            minZ: -room.roomSize.depth + playerRadius,
            maxZ: room.roomSize.depth - playerRadius,
        };
        console.log("Rumsgränser för kollision definierade:", roomBoundaries);
    } else {
        console.error("Kunde inte definiera rumsgränser, rummet eller roomSize saknas.");
    }

    if (typeof createPaintings === 'function') {
        createPaintings(scene, room); 
        if (room && typeof room.setupGalleryLighting === 'function') {
            room.setupGalleryLighting(); 
        } else {
            console.error("room.setupGalleryLighting function is not defined or room object is missing.");
        }
    } else {
        console.error("createPaintings function is not defined. Make sure paintings.js is loaded correctly.");
    }
    
    setupControllers(); 
    window.addEventListener('resize', onWindowResize, false);
    renderer.setAnimationLoop(animate);
}

// startVR, onSessionEnded, setupControllers, createControllerModel, onSelectStart, onWindowResize, animate
// är OFÖRÄNDRADE från versionen i svar #33 (som du fick senast och som hade den sänkta spelarhöjden).
// Den enda ändringen här är att säkerställa att playerRadius är globalt definierad.

function startVR() {
    document.getElementById('info').style.display = 'none';
    document.getElementById('enterVR').style.display = 'none';

    navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    }).then(session => {
        renderer.xr.setSession(session);
        session.addEventListener('end', onSessionEnded);
    }).catch(error => {
        console.error("Failed to start VR session:", error);
        document.getElementById('info').innerHTML = '<h1>Kunde inte starta VR</h1><p>Ett fel uppstod. Försök igen eller kontrollera konsolen.</p>';
        document.getElementById('info').style.display = 'block';
        document.getElementById('enterVR').style.display = 'block';
    });
}

function onSessionEnded() {
    document.getElementById('info').style.display = 'block';
    document.getElementById('enterVR').style.display = 'block';
    
    rightStickController = null;
    leftStickController = null;
    
    console.log("VR Session Ended");
}

function setupControllers() {
    function onControllerConnected(event) {
        const controller = this; 
        const xrInputSource = event.data; 
        if (!xrInputSource) { 
            console.warn("Kontroll ansluten men xrInputSource saknas initialt."); 
            return; 
        }
        controller.inputSource = xrInputSource; 
        console.log(`Kontroll ansluten: ${xrInputSource.handedness || 'okänd hand'}`, controller.uuid, "InputSource:", xrInputSource, "Gamepad:", xrInputSource.gamepad);

        if (xrInputSource.handedness === 'right') { 
            rightStickController = controller; 
            console.log("Höger kontroll tilldelad för RÖRELSE (ID: " + controller.uuid + ").");
        } else if (xrInputSource.handedness === 'left') { 
            leftStickController = controller; 
            console.log("Vänster kontroll tilldelad för ROTATION (ID: " + controller.uuid + ").");
        } else { 
            if (controller === controller1) { 
                if (!leftStickController && !rightStickController) { 
                    leftStickController = controller; 
                    console.warn("Okänd hand för controller1, testar som VÄNSTER (rotation).");
                } else if (rightStickController === controller2 && !leftStickController) { 
                    leftStickController = controller1; 
                    console.warn("Okänd hand för controller1 (controller2 är höger), tilldelad som VÄNSTER (rotation).");
                } else if (!rightStickController && leftStickController === controller2) { 
                     rightStickController = controller1;
                     console.warn("Okänd hand för controller1 (controller2 är vänster), tilldelad som HÖGER (rörelse).");
                }
            } else if (controller === controller2) { 
                 if (!leftStickController && !rightStickController) { 
                    rightStickController = controller; 
                    console.warn("Okänd hand för controller2, testar som HÖGER (rörelse).");
                } else if (leftStickController === controller1 && !rightStickController) { 
                    rightStickController = controller2; 
                    console.warn("Okänd hand för controller2 (controller1 är vänster), tilldelad som HÖGER (rörelse).");
                } else if (!leftStickController && rightStickController === controller1) { 
                    leftStickController = controller2;
                    console.warn("Okänd hand för controller2 (controller1 är höger), tilldelad som VÄNSTER (rotation).");
                }
            }
        }
    }

    function onControllerDisconnected(event) {
        const controller = this;
        const oldHandedness = controller.inputSource ? controller.inputSource.handedness : "okänd (tidigare)";
        console.log(`Kontroll frånkopplad: ${oldHandedness} (ID: ${controller.uuid})`);
        if (rightStickController === controller) {
            console.log("Höger (rörelse) kontroll frånkopplad.");
            rightStickController = null;
        }
        if (leftStickController === controller) {
            console.log("Vänster (rotation) kontroll frånkopplad.");
            leftStickController = null;
        }
        if(controller.inputSource) {
            delete controller.inputSource;
        }
    }

    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('connected', onControllerConnected);
    controller1.addEventListener('disconnected', onControllerDisconnected);
    playerRig.add(controller1); 

    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('connected', onControllerConnected);
    controller2.addEventListener('disconnected', onControllerDisconnected);
    playerRig.add(controller2); 

    const pointerGeometry = new THREE.BoxGeometry(0.005, 0.005, 0.2);
    const pointerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    
    const pointer1 = new THREE.Mesh(pointerGeometry, pointerMaterial.clone());
    pointer1.position.set(0, 0, -0.1);
    controller1.add(pointer1);

    const pointer2 = new THREE.Mesh(pointerGeometry, pointerMaterial.clone());
    pointer2.position.set(0, 0, -0.1);
    controller2.add(pointer2);

    const controllerGrip1 = renderer.xr.getControllerGrip(0);
    const model1 = createControllerModel();
    controllerGrip1.add(model1); 
    playerRig.add(controllerGrip1); 

    const controllerGrip2 = renderer.xr.getControllerGrip(1);
    const model2 = createControllerModel();
    controllerGrip2.add(model2); 
    playerRig.add(controllerGrip2); 
}

function createControllerModel() {
    const geometry = new THREE.CylinderGeometry(0.02, 0.025, 0.18, 12);
    const material = new THREE.MeshStandardMaterial({
        color: 0x282828,
        roughness: 0.4,
        metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

function onSelectStart(event) {
    // Inga specifika interaktioner just nu
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const deltaTime = clock.getDelta();
    const now = clock.getElapsedTime(); // För snap turn cooldown

    // HÖGER STYRSPAK: Rörelse (Framåt/Bakåt och Sidled/Strafe)
    if (rightStickController && rightStickController.inputSource && rightStickController.inputSource.gamepad) {
        const gamepad = rightStickController.inputSource.gamepad;
        const axes = gamepad.axes;
        // console.log("Höger Spak Axes RAW:", axes); 

        if (axes && axes.length >= 4) { 
            const deadZoneMove = 0.1; 
            
            const strafeValue = axes[2] || 0; 
            const moveValue = axes[3] || 0;   

            let deltaX = 0;
            let deltaZ = 0;

            if (Math.abs(moveValue) > deadZoneMove) { 
                const moveDirection = new THREE.Vector3();
                camera.getWorldDirection(moveDirection); 
                moveDirection.y = 0; 
                moveDirection.normalize();
                deltaZ += moveDirection.z * (-moveValue * movementSpeed * deltaTime);
                deltaX += moveDirection.x * (-moveValue * movementSpeed * deltaTime);
            }

            if (Math.abs(strafeValue) > deadZoneMove) {
                const strafeDirection = new THREE.Vector3();
                strafeDirection.setFromMatrixColumn(playerRig.matrixWorld, 0); 
                strafeDirection.y = 0; 
                strafeDirection.normalize();
                deltaX += strafeDirection.x * (strafeValue * movementSpeed * deltaTime);
                deltaZ += strafeDirection.z * (strafeValue * movementSpeed * deltaTime);
            }

            if ((deltaX !== 0 || deltaZ !== 0) && Object.keys(roomBoundaries).length > 0) { // Säkerställ att roomBoundaries är definierat
                const currentX = playerRig.position.x;
                const currentZ = playerRig.position.z;
                let nextX = currentX + deltaX;
                let nextZ = currentZ + deltaZ;

                nextX = Math.max(roomBoundaries.minX, Math.min(roomBoundaries.maxX, nextX));
                nextZ = Math.max(roomBoundaries.minZ, Math.min(roomBoundaries.maxZ, nextZ));
                
                playerRig.position.x = nextX;
                playerRig.position.z = nextZ;
            } else if (deltaX !== 0 || deltaZ !== 0) { // Om roomBoundaries inte är satt än, rör dig fritt (bör inte hända efter init)
                 playerRig.position.x += deltaX;
                 playerRig.position.z += deltaZ;
            }

        } else if (axes) {
            // console.warn("Höger kontroll gamepad.axes har oväntad längd:", axes.length, "Axes:", axes);
        }
    }

    // VÄNSTER STYRSPAK: Mjuk Rotation (eller Snap Turn om du återinför den logiken)
    if (leftStickController && leftStickController.inputSource && leftStickController.inputSource.gamepad) {
        const gamepad = leftStickController.inputSource.gamepad;
        const axes = gamepad.axes;
        // console.log("Vänster Spak Axes RAW:", axes);

        if (axes && axes.length >= 3) { 
            // För mjuk rotation:
            const deadZoneTurn = 0.15; 
            const turnValue = axes[2] || 0; 
            if (Math.abs(turnValue) > deadZoneTurn) { 
                playerRig.rotation.y -= turnValue * rotationSpeed * deltaTime; 
            }

            // Om du vill ha snap turn istället (ta bort mjuk rotation ovan då):
            /*
            const deadZoneSnapStick = 0.2; 
            const turnValueSnap = axes[2] || 0; 
            if (Math.abs(turnValueSnap) < deadZoneSnapStick) {
                leftStickWasCentered = true;
            }
            if (leftStickWasCentered && (now > lastSnapTurnTime + snapTurnCooldown)) {
                if (turnValueSnap > snapTurnThreshold) { 
                    playerRig.rotation.y -= snapTurnAngle; 
                    lastSnapTurnTime = now;
                    leftStickWasCentered = false; 
                } else if (turnValueSnap < -snapTurnThreshold) { 
                    playerRig.rotation.y += snapTurnAngle; 
                    lastSnapTurnTime = now;
                    leftStickWasCentered = false; 
                }
            }
            */
        } else if (axes) {
            // console.warn("Vänster kontroll gamepad.axes har oväntad längd:", axes.length, "Axes:", axes);
        }
    }
    renderer.render(scene, camera);
}

window.onload = function() {
    checkXR(); // Kontrollerar XR-stöd
    init();    // Startar resten av applikationen
};