import type { VisualizationType } from './index';

export const visualizationOptions = [
  {
    value: 'dots' as VisualizationType,
    label: 'Standard Dots',
    description: 'Standard colored circles'
  },
  {
    value: 'pie-charts' as VisualizationType,
    label: 'Pie Charts',
    description: 'Pie charts showing prevalence data'
  },
  {
    value: '3d-bars' as VisualizationType,
    label: '3D Bar Extrusions',
    description: '3D extruded bars showing data height'
  }
];
