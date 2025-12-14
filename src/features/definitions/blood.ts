import * as vscode from 'vscode';
import bloodSnippet from '../../snippets/source/blood/blood_desc.json';
import { BaseDefinitionProvider, BigDefinition } from './baseProvider';
import { logger } from '../../platform/vscode/logger';



export let BloodhoundDefinitionProvider = new BaseDefinitionProvider(
    (params: { document: vscode.TextDocument, position: vscode.Position }): BigDefinition | undefined => {
        const word = BaseDefinitionProvider.getWord(params.document, params.position) ;
        if (!word) {
            return undefined;
        }
        logger.debug(`request keyword ${word}`);
        const description = (bloodSnippet as any)[word] || '';
        return description;
    }
); 
