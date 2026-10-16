import React, { useMemo, useState } from 'react';
import { ControlPanelProps } from '../../types/components';
import { ColorSchemeSelector } from './ColorSchemeSelector';
import { NodeSizeSelector } from './NodeSizeSelector';
import { SearchInput } from './SearchInput';
import { ToggleButton } from './ToggleButton';
import { ThresholdInput } from './ThresholdInput';
import { Select } from '../UI/Select';
import styles from './ControlPanel.module.css';

export const ControlPanel: React.FC<ControlPanelProps> = ({
  state,
  onStateChange,
  graphData,
  clusteringConfig,
  onClusteringConfigChange
}) => {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  // Manage collapsed state for each section
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    search: false,
    colorScheme: false,
    nodeSize: false,
    monorepo: false,
    visibility: false,
    highlights: false,
    panels: false,
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleToggle = (key: keyof typeof state) => {
    onStateChange({ [key]: !state[key] });
  };

  // Extract workspace info and packages from the first node that has it
  const workspaceInfo = useMemo(() => {
    const nodeWithWorkspace = graphData.nodes.find(node => node.workspace);
    return nodeWithWorkspace?.workspace;
  }, [graphData.nodes]);

  // Get unique packages from all nodes
  const availablePackages = useMemo(() => {
    const packages = new Set<string>();
    graphData.nodes.forEach(node => {
      if (node.package) {
        packages.add(node.package);
      }
    });
    return Array.from(packages).sort();
  }, [graphData.nodes]);

  // Only show package filter if workspace is detected and has packages
  const showPackageFilter = workspaceInfo && availablePackages.length > 0;

  if (isPanelCollapsed) {
    return (
      <button
        type="button"
        className={styles.collapsedTrigger}
        onClick={() => setIsPanelCollapsed(false)}
        title="Open Controls Dock"
      >
        <span>🎛️</span>
        <span>Controls</span>
      </button>
    );
  }

  return (
    <div className={styles.controlPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <span>🎛️</span> Controls
        </span>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setIsPanelCollapsed(true)}
          title="Collapse controls sidebar"
        >
          ◀ Hide
        </button>
      </div>
      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('search')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.search ? '▶' : '▼'}
          </span>
          Search
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.search ? styles.collapsed : ''}`}>
          <SearchInput
            value={state.searchQuery}
            onChange={(searchQuery) => onStateChange({ searchQuery })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('colorScheme')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.colorScheme ? '▶' : '▼'}
          </span>
          Color Scheme
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.colorScheme ? styles.collapsed : ''}`}>
          <ColorSchemeSelector
            value={state.colorScheme}
            onChange={(colorScheme) => onStateChange({ colorScheme })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('nodeSize')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.nodeSize ? '▶' : '▼'}
          </span>
          Node Size
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.nodeSize ? styles.collapsed : ''}`}>
          <NodeSizeSelector
            value={state.nodeSizeMode}
            onChange={(nodeSizeMode) => onStateChange({ nodeSizeMode })}
          />
        </div>
      </div>

      {showPackageFilter && (
        <div className={styles.section}>
          <h3 
            className={styles.sectionTitle} 
            onClick={() => toggleSection('monorepo')}
          >
            <span className={styles.collapseIcon}>
              {collapsedSections.monorepo ? '▶' : '▼'}
            </span>
            Monorepo
          </h3>
          <div className={`${styles.sectionContent} ${collapsedSections.monorepo ? styles.collapsed : ''}`}>
            <Select
              value={state.selectedPackage || ''}
              onChange={(value) => onStateChange({ selectedPackage: value || null })}
              options={[
                { value: '', label: `All Packages (${availablePackages.length})` },
                ...availablePackages.map(pkg => ({
                  value: pkg,
                  label: pkg
                }))
              ]}
            />
            {state.selectedPackage && (
              <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666' }}>
                Showing: {graphData.nodes.filter(n => n.package === state.selectedPackage).length} files
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('visibility')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.visibility ? '▶' : '▼'}
          </span>
          Visibility
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.visibility ? styles.collapsed : ''}`}>
          <div className={styles.buttonGrid}>
            <ToggleButton
              active={state.testsHidden}
              label="Hide Tests"
              icon="🧪"
              onClick={() => handleToggle('testsHidden')}
              size="small"
              tooltip="Hide test files from the visualization"
            />
            <ToggleButton
              active={state.externalNodesHidden}
              label="Hide External"
              icon="📦"
              onClick={() => handleToggle('externalNodesHidden')}
              size="small"
              tooltip="Hide external dependencies (node_modules) from the visualization"
            />
            <ToggleButton
              active={state.backendOnlyMode}
              label="Backend Only"
              icon="🖥️"
              onClick={() => handleToggle('backendOnlyMode')}
              size="small"
              tooltip="Show only Node.js backend files (Express, NestJS, Fastify)"
            />
            <ToggleButton
              active={state.apiRoutesOnlyMode}
              label="API Routes"
              icon="🔌"
              onClick={() => handleToggle('apiRoutesOnlyMode')}
              size="small"
              tooltip="Show only files with HTTP methods (API routes)"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('highlights')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.highlights ? '▶' : '▼'}
          </span>
          Highlights
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.highlights ? styles.collapsed : ''}`}>
          <div className={styles.buttonGrid}>
            <ToggleButton
              active={state.orphansHighlighted}
              label="Orphans"
              icon="🏝️"
              onClick={() => handleToggle('orphansHighlighted')}
              size="small"
              tooltip="Highlight orphan files - files that are not imported by any other file in the project"
            />
            <ToggleButton
              active={state.circularDepsHighlighted}
              label="Circular Deps"
              icon="🔄"
              onClick={() => handleToggle('circularDepsHighlighted')}
              size="small"
              tooltip="Highlight circular dependencies - files that form a loop where A imports B, B imports C, and C imports A"
            />
          </div>
          
          <div className={styles.thresholdGroup}>
            <ThresholdInput
              label="Line Count"
              icon="📏"
              value={state.lineCountThreshold}
              enabled={state.lineCountThresholdEnabled}
              onValueChange={(lineCountThreshold) => onStateChange({ lineCountThreshold })}
              onEnabledChange={(lineCountThresholdEnabled) => onStateChange({ lineCountThresholdEnabled })}
              min={10}
              max={1000}
              step={10}
              tooltip="Highlight files with line count greater than or equal to the threshold value"
            />
            <ThresholdInput
              label="Dependencies"
              icon="🔗"
              value={state.dependencyThreshold}
              enabled={state.dependencyThresholdEnabled}
              onValueChange={(dependencyThreshold) => onStateChange({ dependencyThreshold })}
              onEnabledChange={(dependencyThresholdEnabled) => onStateChange({ dependencyThresholdEnabled })}
              min={1}
              max={100}
              step={1}
              tooltip="Highlight files with total dependencies (imports + importers) greater than or equal to the threshold value"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 
          className={styles.sectionTitle} 
          onClick={() => toggleSection('panels')}
        >
          <span className={styles.collapseIcon}>
            {collapsedSections.panels ? '▶' : '▼'}
          </span>
          Panels
        </h3>
        <div className={`${styles.sectionContent} ${collapsedSections.panels ? styles.collapsed : ''}`}>
          <div className={styles.buttonGroup}>
            <ToggleButton
              active={state.legendVisible}
              label="Legend"
              icon="📊"
              onClick={() => handleToggle('legendVisible')}
              size="small"
              tooltip="Show/hide the legend panel explaining node colors and sizes"
            />
            <ToggleButton
              active={state.circularDepsPanelVisible}
              label={`Circular (${graphData.circularDependencies.length})`}
              icon="🔄"
              onClick={() => handleToggle('circularDepsPanelVisible')}
              size="small"
              tooltip="Show/hide the circular dependencies panel listing all detected circular import chains"
            />
            <ToggleButton
              active={state.externalDepsPanelVisible}
              label={`External (${graphData.externalDependencies.size})`}
              icon="📦"
              onClick={() => handleToggle('externalDepsPanelVisible')}
              size="small"
              tooltip="Show/hide the external dependencies panel listing all npm packages and external imports"
            />
          </div>
        </div>
      </div>
    </div>
  );
};