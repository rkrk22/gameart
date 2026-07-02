import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Group, Vector3 } from "three";

const OBJECT_POSITION = [-0.54, 0, 0] as const;

type BookModelProps = {
  autoRotate: boolean;
};

function BookModel({ autoRotate }: BookModelProps) {
  const { scene } = useGLTF("/book3d.glb");
  const groupRef = useRef<Group>(null);

  const { clonedScene, modelPosition, scale } = useMemo(() => {
    const nextScene = scene.clone();
    const box = new Box3().setFromObject(nextScene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const normalizedScale = 1.95 / maxAxis;

    return {
      clonedScene: nextScene,
      modelPosition: [
        -center.x * normalizedScale,
        -center.y * normalizedScale - 0.02,
        -center.z * normalizedScale,
      ] as const,
      scale: normalizedScale,
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (!autoRotate || !groupRef.current) return;
    groupRef.current.rotation.z += delta * 0.16;
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 2, 0.24, -0.08]} position={OBJECT_POSITION}>
      <group scale={scale} position={modelPosition}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

export function HomeBookCanvas() {
  const [isInteracting, setIsInteracting] = useState(false);

  return (
    <div className="pointer-events-auto h-[420px] w-full md:h-[560px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 30 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
        <fog attach="fog" args={["#fff7f2", 7, 12]} />
        <ambientLight intensity={1.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.5} color="#fff4ea" />
        <directionalLight position={[-4, 2, -3]} intensity={1.15} color="#ffd9cc" />
        <pointLight position={[0, -1, 4]} intensity={1.1} color="#fff8ef" />

        <Suspense fallback={null}>
          <BookModel autoRotate={!isInteracting} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          target={OBJECT_POSITION}
          onStart={() => setIsInteracting(true)}
          onEnd={() => setIsInteracting(false)}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/book3d.glb");
