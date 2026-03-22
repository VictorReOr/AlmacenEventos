import React from 'react';
import { 
  Settings, 
  ShieldCheck, 
  BoxSelect, 
  Move, 
  PenTool, 
  Grid, 
  Printer, 
  CloudDownload, 
  Save, 
  Undo2, 
  Redo2, 
  Maximize 
} from 'lucide-react';

export interface IconProps {
  size?: number;
  color?: string;
  active?: boolean;
}

const getProps = (props: IconProps) => ({
  size: props.size || 24,
  color: props.color || (props.active ? '#2196F3' : 'currentColor'),
  strokeWidth: props.active ? 2.5 : 2, // Thicker if active for more pop
});

export const IconSettings = (props: IconProps) => <Settings {...getProps(props)} />;
export const IconShield = (props: IconProps) => <ShieldCheck {...getProps(props)} />;
export const IconSelection = (props: IconProps) => <BoxSelect {...getProps(props)} />;
export const IconMove = (props: IconProps) => <Move {...getProps(props)} />;
export const IconWallEdit = (props: IconProps) => <PenTool {...getProps(props)} />;
export const IconGrid = (props: IconProps) => <Grid {...getProps(props)} />;
export const IconPrinter = (props: IconProps) => <Printer {...getProps(props)} />;
export const IconCloudDown = (props: IconProps) => <CloudDownload {...getProps(props)} />;
export const IconSave = (props: IconProps) => <Save {...getProps(props)} />;
export const IconUndo = (props: IconProps) => <Undo2 {...getProps(props)} />;
export const IconRedo = (props: IconProps) => <Redo2 {...getProps(props)} />;
export const IconFitView = (props: IconProps) => <Maximize {...getProps(props)} />;
