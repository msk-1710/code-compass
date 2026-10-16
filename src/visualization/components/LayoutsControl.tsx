import { useSigma } from "@react-sigma/core";
import { useLayoutCirclepack } from "@react-sigma/layout-circlepack";
import { useLayoutCircular } from "@react-sigma/layout-circular";
import { LayoutHook } from "@react-sigma/layout-core";
import { useLayoutForce } from "@react-sigma/layout-force";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { useLayoutNoverlap } from "@react-sigma/layout-noverlap";
import { useLayoutRandom } from "@react-sigma/layout-random";
import React, { useEffect, useMemo, useState } from "react";
import { animateNodes } from "sigma/utils";

type LayoutName = "circular" | "circlepack" | "random" | "noverlaps" | "forceDirected" | "forceAtlas";

export const LayoutsControl: React.FC = () => {
  const sigma = useSigma();
  const [layout, setLayout] = useState<LayoutName>("forceAtlas");
  const [opened, setOpened] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasNormalizedPositions, setHasNormalizedPositions] = useState<boolean>(false);
  const layoutCircular = useLayoutCircular();
  const layoutCirclepack = useLayoutCirclepack();
  const layoutRandom = useLayoutRandom();
  const layoutNoverlap = useLayoutNoverlap();
  const layoutForce = useLayoutForce({ maxIterations: 500 });
  const layoutForceAtlas2 = useLayoutForceAtlas2({
    iterations: 500,
    settings: {
      barnesHutOptimize: true,
      barnesHutTheta: 1,
      scalingRatio: 50,
      strongGravityMode: true,
      gravity: 1,
      slowDown: 2,
      linLogMode: false,
      adjustSizes: true,
      outboundAttractionDistribution: false,
    },
  });
  const layouts = useMemo(() => {
    return {
      circular: {
        layout: layoutCircular,
      },
      circlepack: {
        layout: layoutCirclepack,
      },
      random: {
        layout: layoutRandom,
      },
      noverlaps: {
        layout: layoutNoverlap,
      },
      forceDirected: {
        layout: layoutForce,
      },
      forceAtlas: {
        layout: layoutForceAtlas2,
      },
    } as { [key: string]: { layout: LayoutHook } };
  }, [
    layoutCirclepack,
    layoutCircular,
    layoutForce,
    layoutForceAtlas2,
    layoutNoverlap,
    layoutRandom,
  ]);

  // Apply initial layout on mount
  useEffect(() => {
    if (!isInitialized) {
      // For ForceAtlas2, we need to normalize positions first
      // Otherwise nodes with large initial coordinates get squished
      if (layout === "forceAtlas" && !hasNormalizedPositions) {
        console.log('[DEBUG] Normalizing positions for ForceAtlas2 with random layout first');
        const graph = sigma.getGraph();
        const { assign: assignRandom } = layoutRandom;
        
        // Use assign() to directly set positions on the graph
        assignRandom();
        setHasNormalizedPositions(true);
        
        // Now apply ForceAtlas2 after a brief delay to ensure positions are set
        setTimeout(() => {
          const { positions } = layouts[layout].layout;
          const newPositions = positions();
          
          // DIAGNOSTIC: Log layout positions
          const posArray = Object.entries(newPositions).slice(0, 5);
          console.log(`[DEBUG] Initial ${layout} layout positions (after normalization):`, {
            sampleCount: posArray.length,
            positions: posArray.map(([id, pos]) => ({ id, x: pos.x, y: pos.y }))
          });
          
          animateNodes(graph, newPositions, { duration: 1000 });
        }, 50);
      } else {
        const { positions } = layouts[layout].layout;
        const newPositions = positions();
        
        // DIAGNOSTIC: Log layout positions
        const posArray = Object.entries(newPositions).slice(0, 5);
        console.log(`[DEBUG] Initial ${layout} layout positions:`, {
          sampleCount: posArray.length,
          positions: posArray.map(([id, pos]) => ({ id, x: pos.x, y: pos.y }))
        });
        
        animateNodes(sigma.getGraph(), newPositions, { duration: 1000 });
      }
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  // Apply layout when user changes it
  useEffect(() => {
    if (isInitialized) {
      const graph = sigma.getGraph();
      
      // When switching TO ForceAtlas2, normalize positions if needed
      if (layout === "forceAtlas" && !hasNormalizedPositions) {
        console.log('[DEBUG] Normalizing positions before switching to ForceAtlas2');
        const { assign: assignRandom } = layoutRandom;
        
        // Use assign() to directly set positions on the graph
        assignRandom();
        setHasNormalizedPositions(true);
        
        setTimeout(() => {
          const { positions } = layouts[layout].layout;
          const newPositions = positions();
          
          const posArray = Object.entries(newPositions).slice(0, 5);
          console.log(`[DEBUG] Switching to ${layout} layout (after normalization):`, {
            sampleCount: posArray.length,
            positions: posArray.map(([id, pos]) => ({ id, x: pos.x, y: pos.y }))
          });
          
          animateNodes(graph, newPositions, { duration: 1000 });
        }, 50);
      } else {
        const { positions } = layouts[layout].layout;
        const newPositions = positions();
        
        // DIAGNOSTIC: Log layout positions when switching
        const posArray = Object.entries(newPositions).slice(0, 5);
        console.log(`[DEBUG] Switching to ${layout} layout:`, {
          sampleCount: posArray.length,
          positions: posArray.map(([id, pos]) => ({ id, x: pos.x, y: pos.y }))
        });
        
        animateNodes(graph, newPositions, { duration: 1000 });
        
        // Mark as normalized when switching away from ForceAtlas2
        if (layout === "random") {
          setHasNormalizedPositions(true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, isInitialized]);

  useEffect(() => {
    const close = () => {
      setOpened(false);
    };
    if (opened === true) {
      setTimeout(() => document.addEventListener("click", close), 0);
    }
    return () => document.removeEventListener("click", close);
  }, [opened]);

  return (
    <>
      <div>
        <div className="react-sigma-control">
          <button onClick={() => setOpened((e: boolean) => !e)}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
              <circle cx="5" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <line x1="12" y1="9" x2="12" y2="15" />
              <line x1="9" y1="12" x2="15" y2="12" />
            </svg>
          </button>
          {opened === true && (
            <ul
              style={{
                position: "absolute",
                bottom: 0,
                right: "35px",
                backgroundColor: "#2a2a2a",
                margin: 0,
                padding: "8px 0",
                listStyle: "none",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                minWidth: "150px",
              }}
            >
              {Object.keys(layouts).map((name) => {
                return (
                  <li key={name}>
                    <button
                      style={{
                        fontWeight: layout === name ? "bold" : "normal",
                        width: "100%",
                        padding: "8px 16px",
                        border: "none",
                        background: layout === name ? "#3498db" : "transparent",
                        color: "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "14px",
                      }}
                      onClick={() => {
                        setLayout(name as LayoutName);
                      }}
                      onMouseEnter={(e) => {
                        if (layout !== name) {
                          e.currentTarget.style.background = "#444444";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (layout !== name) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};
