// scripts/paintings.js

const paintingObjects = []; // Array för att lagra alla tavel-meshobjekt
let textureLoaderInstanceP;

// Ljudfunktioner kan tas bort helt om de inte används för något annat.
// Behåll dem om du vill ha t.ex. bakgrundsmusik eller ljudeffekter senare.
// function initSounds() { console.log("Sound system for paintings initialized."); }
// function playSound(soundType) { /* ... */ }

function createPaintings(scene, roomInstance) { // Tar emot roomInstance för att kunna lägga till referens
    if (!textureLoaderInstanceP) {
        textureLoaderInstanceP = new THREE.TextureLoader();
    }

    const W_half = roomInstance.roomSize.width;  // t.ex. 6 för 12m bredd
    const H_gallery = roomInstance.roomSize.height; // t.ex. 4.5m
    const D_half = roomInstance.roomSize.depth;  // t.ex. 9 för 18m djup
    
    const paintingCenterY = H_gallery * 0.55; // Centrera tavlorna lite högre än mitten
    const wallOffset = 0.06; // Lite framför väggen för att undvika z-fighting

    // Tavlorna är stora och vertikala
    const paintingHeight = H_gallery * 0.7; // t.ex. 4.5 * 0.7 = 3.15m höga
    const paintingWidth = paintingHeight / 1.5; // Exempel på proportioner

    const paintingData = [
        // Vänster vägg (2 tavlor)
        {
            id: "painting_left_1",
            imagePath: "images/tavla1.jpg", // Byt till dina bildfiler!
            position: new THREE.Vector3(-W_half + wallOffset, paintingCenterY, -D_half * 0.4), // Framre delen av vänster vägg
            rotationY: Math.PI / 2,
            size: { width: paintingWidth, height: paintingHeight }
        },
        {
            id: "painting_left_2",
            imagePath: "images/tavla2.jpg",
            position: new THREE.Vector3(-W_half + wallOffset, paintingCenterY, D_half * 0.4), // Bakre delen av vänster vägg
            rotationY: Math.PI / 2,
            size: { width: paintingWidth, height: paintingHeight }
        },
        // Bakvägg (1 tavla, centrerad)
        {
            id: "painting_back_center",
            imagePath: "images/tavla3.jpg",
            position: new THREE.Vector3(0, paintingCenterY, D_half - wallOffset),
            rotationY: Math.PI,
            size: { width: paintingWidth * 1.8, height: paintingHeight * 0.9 } // Större, mer panorama?
        },
        // Höger vägg (2 tavlor)
        {
            id: "painting_right_1",
            imagePath: "images/tavla4.jpg",
            position: new THREE.Vector3(W_half - wallOffset, paintingCenterY, -D_half * 0.4), // Framre delen av höger vägg
            rotationY: -Math.PI / 2,
            size: { width: paintingWidth, height: paintingHeight }
        },
        {
            id: "painting_right_2",
            imagePath: "images/tavla5.jpg",
            position: new THREE.Vector3(W_half - wallOffset, paintingCenterY, D_half * 0.4), // Bakre delen av höger vägg
            rotationY: -Math.PI / 2,
            size: { width: paintingWidth, height: paintingHeight }
        }
    ];

    paintingData.forEach(data => {
        const paintingTexture = textureLoaderInstanceP.load(data.imagePath,
            undefined, undefined,
            (err) => { console.error('Kunde inte ladda bild för tavla:', data.imagePath, err); }
        );
        paintingTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Förbättrar skärpan

        const paintingMaterial = new THREE.MeshStandardMaterial({
            map: paintingTexture,
            roughness: 0.85, // Tavlor är oftast inte blanka
            metalness: 0.0,  // Inte metalliska
            side: THREE.FrontSide,
            // emissive: 0x111111, // Mycket svagt emissive för att "lysa upp" sig själv lite om belysningen är svår
            // emissiveMap: paintingTexture // Om du vill att ljusa delar av tavlan ska lysa mer
        });

        const paintingGeometry = new THREE.PlaneGeometry(data.size.width, data.size.height);
        const paintingMesh = new THREE.Mesh(paintingGeometry, paintingMaterial);

        paintingMesh.position.copy(data.position);
        paintingMesh.rotation.y = data.rotationY;
        
        paintingMesh.castShadow = false; // Tavlor kastar sällan meningsfulla skuggor om de är platta mot väggen
        paintingMesh.receiveShadow = true; // Kan ta emot skuggor från t.ex. bänken eller spelaren

        paintingMesh.userData = { id: data.id, isPainting: true };
        scene.add(paintingMesh);
        paintingObjects.push(paintingMesh);
        if (roomInstance && typeof roomInstance.addPaintingReference === 'function') {
            roomInstance.addPaintingReference({mesh: paintingMesh, data: data}); // Skicka referens till rummet för belysning
        }
    });
}

function getAllPaintingObjects() {
    return paintingObjects;
}