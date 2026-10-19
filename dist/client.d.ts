import React from 'react';
import type { JSONFieldClientProps } from 'payload';
import { type ComposerContent } from './content.js';
type CanvasProps = {
    value: ComposerContent | null | undefined;
    onChange: (value: ComposerContent) => void;
    apiURL?: string;
    mode?: 'widget' | 'live';
    readOnly?: boolean;
    height?: number;
    title?: string;
};
/** Dashboard notice; individual fields also show verification errors before mounting. */
export declare function PageComposerLicenseNotice(): React.JSX.Element | null;
export declare function PageComposerCanvas({ value, onChange, apiURL, mode, readOnly, height, title }: CanvasProps): React.JSX.Element;
export declare const PageComposerField: React.FC<{
    readonly field: Omit<import("payload").JSONFieldClient, "type"> & Partial<Pick<import("payload").JSONFieldClient, "type">>;
} & Omit<import("payload").ClientComponentProps, "field" | "customComponents"> & {
    readonly path: string;
    readonly validate?: import("payload").JSONFieldValidation;
} & {
    height?: number;
    liveEditURL?: string;
}>;
type TagOption = {
    value: string;
    label: string;
};
export declare const PageComposerPresetTagField: React.FC<{
    readonly field: Omit<import("payload").TextFieldClient, "type"> & Partial<Pick<import("payload").TextFieldClient, "type">>;
} & Omit<import("payload").ClientComponentProps, "field" | "customComponents"> & {
    readonly inputRef?: React.RefObject<HTMLInputElement>;
    readonly onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    readonly path: string;
    readonly validate?: import("payload").TextFieldValidation;
} & {
    options?: TagOption[];
}>;
export declare const PageComposerPresetField: React.FC<JSONFieldClientProps>;
export type LiveEditorProps = {
    value: ComposerContent;
    collection?: string;
    id?: string | number;
    global?: string;
    fieldPath?: string;
    apiURL?: string;
    drafts?: boolean;
    published?: boolean;
    locale?: string;
    exitURL: string;
    /** Override saving for nested arrays/blocks or an application's own workflow. */
    onSave?: (value: ComposerContent, publish: boolean) => Promise<void>;
};
/** Render only after a server-side admin authorization check. All writes still use Payload REST access controls. */
export declare function PageComposerLiveEditor(props: LiveEditorProps): React.JSX.Element;
export {};
