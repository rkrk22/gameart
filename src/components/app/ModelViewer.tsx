import { Component, Suspense, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

interface ModelViewerProps {
  src: string;
  title?: string;
}

class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <p role="alert" className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Unable to display the 3D model. Please reload the page to try again.</p>;
    }
    return this.props.children;
  }
}

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const { model, scale, position } = useMemo(() => {
    // Preserve the skeleton bindings when the GLB contains a rigged character.
    const model = clone(scene);
    const box = new Box3().setFromObject(model, true);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = 2.4 / (Math.max(size.x, size.y, size.z) || 1);
    return {
      model,
      scale,
      position: center.multiplyScalar(-scale).toArray() as [number, number, number],
    };
  }, [scene]);

  return <group scale={scale} position={position}><primitive object={model} /></group>;
}

export default function ModelViewer({ src, title = "3D character" }: ModelViewerProps) {
  const [isInteracting, setIsInteracting] = useState(false);

  return (
    <figure className="not-prose my-6 overflow-hidden rounded-2xl border border-border bg-muted/30">
      <div className="h-[360px] w-full sm:h-[480px]" role="region" aria-label={`${title} — interactive 3D model`}>
        <ModelErrorBoundary key={src}>
          <Canvas camera={{ position: [0, 0.25, 5], fov: 35 }} dpr={[1, 1.75]} gl={{ alpha: true }}
            fallback={<p className="p-6 text-sm text-muted-foreground">Your browser does not support 3D viewing.</p>}>
            <ambientLight intensity={1.9} />
            <directionalLight position={[3, 4, 5]} intensity={2.5} color="#fff4ea" />
            <directionalLight position={[-4, 2, -3]} intensity={1.15} color="#ffd9cc" />
            <pointLight position={[0, -1, 4]} intensity={1.1} color="#fff8ef" />
            <Suspense fallback={<Html center><span role="status" className="whitespace-nowrap text-sm text-muted-foreground">Loading 3D model…</span></Html>}>
              <Model src={src} />
            </Suspense>
            <OrbitControls enablePan={false} enableDamping minDistance={3} maxDistance={8}
              autoRotate={!isInteracting} autoRotateSpeed={0.7}
              onStart={() => setIsInteracting(true)} onEnd={() => setIsInteracting(false)} />
          </Canvas>
        </ModelErrorBoundary>
      </div>
      <figcaption className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
        Drag to rotate · Scroll or pinch to zoom
      </figcaption>
    </figure>
  );
}
