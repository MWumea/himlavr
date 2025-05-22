// scripts/room.js

class Room {
    constructor(scene) {
        this.scene = scene;
        this.roomSize = {
            width: 4,    // Halva totala bredden (total bredd 8m)
            height: 4.0, // Total höjd 4.0m (upp till pyramidens bas)
            depth: 4     // Halva totala djupet (total djup 8m)
        };
        console.log("Room constructor roomSize:", JSON.stringify(this.roomSize));

        if (this.roomSize.width <= 0 || this.roomSize.height <= 0 || this.roomSize.depth <= 0) {
            console.error("Ogiltiga dimensioner i roomSize! Alla måste vara positiva.", this.roomSize);
            this.roomSize.width = Math.max(1, this.roomSize.width);
            this.roomSize.height = Math.max(1, this.roomSize.height);
            this.roomSize.depth = Math.max(1, this.roomSize.depth);
        }

        this.textureLoader = new THREE.TextureLoader();
        this.paintings = []; 
        this.pyramidHeight = 0; 
    }

    addPaintingReference(paintingWrapper) {
        this.paintings.push(paintingWrapper);
    }

    loadRepeatingTexture(path, repeatsX, repeatsY, aniso) {
        console.log(`Försöker ladda textur: ${path}`);
        const texture = this.textureLoader.load(path,
            () => { console.log(`Textur SUCCESSFULLT laddad: ${path}`); },
            undefined, 
            (err) => { console.error(`Kunde INTE ladda textur: ${path}`, err); }
        );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatsX, repeatsY);
        if (aniso && typeof renderer !== 'undefined' && renderer.capabilities) { 
             texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        return texture;
    }

    create() {
        console.log("Room.create() anropad");
        this.createFloor();
        this.createCeiling(); 
        this.createWalls();
        this.createCenterBench();
    }

    createFloor() {
        console.log("createFloor() anropad. roomSize:", JSON.stringify(this.roomSize));
        const floorWidth = this.roomSize.width * 2;
        const floorDepth = this.roomSize.depth * 2;
        console.log(`Golvdimensioner: Bredd=${floorWidth}, Djup=${floorDepth}`);

        if (floorWidth <= 0 || floorDepth <= 0) {
            console.error("Ogiltiga dimensioner för golvgeometri!");
            return;
        }
        const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
        
        let floorMaterial;
        try {
            const floorColorMap = this.loadRepeatingTexture('images/textures/light_wood_floor_color.jpg', 6, 6); 
            const floorRoughnessMap = this.loadRepeatingTexture('images/textures/light_wood_floor_roughness.jpg', 6, 6);

            floorMaterial = new THREE.MeshStandardMaterial({
                map: floorColorMap,
                roughnessMap: floorRoughnessMap,
                metalness: 0.05,
                envMapIntensity: 0.6 
            });
        } catch (e) {
            console.error("Fel vid laddning av golvtexturer, använder fallback-färg.", e);
            floorMaterial = new THREE.MeshStandardMaterial({
                color: 0x8c7853, 
                roughness: 0.7,
                metalness: 0.05
            });
        }

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);
        console.log("Golv skapat.");
    }

    createCeiling() { 
        console.log("createCeiling() anropad (Pyramid). roomSize:", JSON.stringify(this.roomSize));
        
        // Önskad sidlängd på pyramidens bas (ska matcha rummets bredd/djup)
        const desiredBaseSideLength = this.roomSize.width * 2; // Eftersom rummet är kvadratiskt (width = depth)
        
        // Radien som behövs för ConeGeometry för att uppnå desiredBaseSideLength efter 45 graders rotation.
        // En ConeGeometry med 4 segment och denna radie, roterad PI/4, får sidlängden 'desiredBaseSideLength'.
        const pyramidRadiusForCone = desiredBaseSideLength / Math.sqrt(2); 
        
        this.pyramidHeight = this.roomSize.height * 0.6; 

        console.log(`Pyramiddimensioner: Önskad BasSida=${desiredBaseSideLength.toFixed(2)}, ConeRadius=${pyramidRadiusForCone.toFixed(2)}, Höjd=${this.pyramidHeight.toFixed(2)}`);

        if (pyramidRadiusForCone <= 0 || this.pyramidHeight <= 0) {
            console.error("Ogiltiga dimensioner för pyramid!");
            return;
        }

        const glassMaterial = new THREE.MeshPhysicalMaterial({
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.95,
            transparent: true,
            ior: 1.5,
            side: THREE.DoubleSide,
            envMapIntensity: 1.0, 
        });

        const pyramidGeometry = new THREE.ConeGeometry(pyramidRadiusForCone, this.pyramidHeight, 4, 1, false); 
        const pyramid = new THREE.Mesh(pyramidGeometry, glassMaterial);
        
        pyramid.position.set(0, this.roomSize.height + this.pyramidHeight / 2, 0); 
        pyramid.rotation.y = Math.PI / 4; // Rotera 45 grader för att sidorna ska vara parallella med väggar

        pyramid.castShadow = true; 
        pyramid.receiveShadow = true; 
        this.scene.add(pyramid);
        console.log("Glaspyramid (tak) skapad med korrigerad storlek.");
    }

    createWalls() {
        console.log("createWalls() anropad. roomSize:", JSON.stringify(this.roomSize));
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5, 
            roughness: 0.9,  
            metalness: 0.0,
            side: THREE.DoubleSide,
            envMapIntensity: 0.3
        });

        this.createWall(new THREE.Vector3(0, this.roomSize.height / 2, -this.roomSize.depth), new THREE.Euler(0, 0, 0), wallMaterial.clone(), 'front');
        this.createWall(new THREE.Vector3(0, this.roomSize.height / 2, this.roomSize.depth), new THREE.Euler(0, Math.PI, 0), wallMaterial.clone(), 'back');
        this.createWall(new THREE.Vector3(-this.roomSize.width, this.roomSize.height / 2, 0), new THREE.Euler(0, Math.PI / 2, 0), wallMaterial.clone(), 'left');
        this.createWall(new THREE.Vector3(this.roomSize.width, this.roomSize.height / 2, 0), new THREE.Euler(0, -Math.PI / 2, 0), wallMaterial.clone(), 'right');
        console.log("Väggar skapade.");
    }
    
    createWall(position, rotationEuler, material, wallId) {
        const wallHeight = this.roomSize.height;
        const wallPlaneWidth = this.roomSize.width * 2; 

        console.log(`createWall (${wallId}): PlaneWidth=${wallPlaneWidth}, PlaneHeight=${wallHeight}`);
        if (wallPlaneWidth <= 0 || wallHeight <= 0) {
            console.error(`Ogiltiga dimensioner för vägg ${wallId}!`);
            return;
        }

        const wallGeometry = new THREE.PlaneGeometry(wallPlaneWidth, wallHeight);
        const wall = new THREE.Mesh(wallGeometry, material); 
        wall.position.copy(position);
        wall.rotation.copy(rotationEuler);
        wall.userData.wallId = wallId;
        wall.receiveShadow = true;
        this.scene.add(wall);
        return wall;
    }

    createCenterBench() {
        console.log("createCenterBench() anropad. roomSize:", JSON.stringify(this.roomSize));
        const benchLength = this.roomSize.width * 0.5; 
        const benchWidth = 0.7; 
        const benchHeight = 0.65; 
        
        console.log(`Bänkdimensioner: Längd=${benchLength.toFixed(2)}, Bredd=${benchWidth}, Höjd=${benchHeight}`);

        if (benchLength <= 0 || benchWidth <= 0 || benchHeight <= 0) {
            console.error("Ogiltiga dimensioner för bänk!");
            return;
        }

        const benchGeometry = new THREE.BoxGeometry(benchLength, benchHeight, benchWidth);
        const benchMaterial = new THREE.MeshStandardMaterial({
            color: 0xdadada, 
            roughness: 0.7,
            metalness: 0.1,
            envMapIntensity: 0.5
        });
        const bench = new THREE.Mesh(benchGeometry, benchMaterial);
        bench.position.set(0, benchHeight / 2, 0); 
        bench.castShadow = true; 
        bench.receiveShadow = true;
        this.scene.add(bench);
        console.log("Bänk skapad med höjd 0.65 och anpassad längd.");
    }

    setupGalleryLighting() {
        console.log("setupGalleryLighting() anropad. Antal tavlor att belysa:", this.paintings.length);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
        this.scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xccccff, 0x999966, 0.65); 
        hemisphereLight.position.y = this.roomSize.height;
        this.scene.add(hemisphereLight);

        const sunLight = new THREE.DirectionalLight(0xfff0e5, 0.8); 
        sunLight.position.set(this.roomSize.width, this.roomSize.height + this.pyramidHeight + 2 , this.roomSize.depth * 0.7); 
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1; 
        sunLight.shadow.camera.far = this.roomSize.depth * 2 + this.roomSize.height + this.pyramidHeight + 10; 
        const shadowCamSize = Math.max(this.roomSize.width, this.roomSize.depth) * 1.5;
        sunLight.shadow.camera.left = -shadowCamSize;
        sunLight.shadow.camera.right = shadowCamSize;
        sunLight.shadow.camera.top = shadowCamSize;
        sunLight.shadow.camera.bottom = -shadowCamSize;
        sunLight.shadow.bias = -0.0005;
        this.scene.add(sunLight);
        // const sunHelper = new THREE.DirectionalLightHelper(sunLight, 5);
        // this.scene.add(sunHelper);

        this.paintings.forEach((paintingWrapper, index) => {
            if (!paintingWrapper || !paintingWrapper.mesh || !paintingWrapper.data) {
                console.warn(`Saknar data för spotlight ${index}.`);
                return;
            }

            const paintingMesh = paintingWrapper.mesh;
            const paintingData = paintingWrapper.data;
            const paintingPosition = new THREE.Vector3();
            paintingMesh.getWorldPosition(paintingPosition);

            const spotlight = new THREE.SpotLight(0xfff8e7, 0.9, 15, Math.PI / 4.5, 0.35, 1.5); 
            
            let spY = paintingPosition.y + paintingData.size.height * 0.1; 
            spY = Math.min(spY, this.roomSize.height - 0.5); 

            const distanceFromPainting = 2.0; 

            const normal = new THREE.Vector3(0, 0, 1); 
            normal.applyQuaternion(paintingMesh.quaternion); 

            const spX = paintingPosition.x - normal.x * distanceFromPainting; 
            const spZ = paintingPosition.z - normal.z * distanceFromPainting; 

            spotlight.position.set(spX, spY, spZ);
            spotlight.target = paintingMesh;

            // console.log(`Spotlight ${index} för ${paintingData.id}: Pos (${spX.toFixed(1)}, ${spY.toFixed(1)}, ${spZ.toFixed(1)}) Targetting ID: ${paintingMesh.userData.id}`);

            spotlight.castShadow = false; 
            this.scene.add(spotlight);
            this.scene.add(spotlight.target);

            // const spotLightHelper = new THREE.SpotLightHelper(spotlight);
            // this.scene.add(spotLightHelper);
        });
        console.log("Galleribelysning uppsatt.");
    }
}