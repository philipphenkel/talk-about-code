import { Utils } from './Utils';

function changeToEdit(
    change: monaco.editor.IModelContentChange
): monaco.editor.IIdentifiedSingleEditOperation {
    const range = new monaco.Range(
        change.range.startLineNumber,
        change.range.startColumn,
        change.range.endLineNumber,
        change.range.endColumn
    );

    return {
        identifier: { major: 1, minor: 0 },
        range: range,
        text: change.text,
        forceMoveMarkers: false
    };
}

function changesToEdits(
    changes: monaco.editor.IModelContentChange[]
): monaco.editor.IIdentifiedSingleEditOperation[] {
    return changes.map(changeToEdit);
}

interface Message {
    clientId: string;
    type: string;
}

interface EditMessage extends Message {
    edits: monaco.editor.IIdentifiedSingleEditOperation[];
}

interface SyncMessage extends Message {
    clientActivity: number;
    content: string;
}

class SyncEngine {
    public static readonly HEARTBEAT_DURATION: number = 5000;

    private static readonly SYNC_TIMEOUT: number = 5000;

    private editor: monaco.editor.ICodeEditor;
    private model: monaco.editor.IModel;
    // tslint:disable-next-line:no-any
    private pubSubClient: any;

    private channel: string;
    private heartbeatChannel: string;
    private languageChannel: string;
    private selectionsChannel: string;
    private clientId: string;
    private clientActivity: number;
    private isRemoteEditInProgress: boolean;
    private syncTimer: number;
    private heartbeatTimer: number;
    // tslint:disable-next-line:no-any
    private contentSubscription: any;
    // tslint:disable-next-line:no-any
    private selectionsSubscription: any;
    private remoteSelectionDecorationId: string;
    private isLocalSelectionPublished: boolean;

    constructor(
        editor: monaco.editor.ICodeEditor,
        // tslint:disable-next-line:no-any
        pubSubClient: any,
        boardId: string,
        boardContent: string
    ) {

        this.editor = editor;
        this.model = editor.getModel();
        if (boardContent) {
            this.model.setValue(boardContent);
            this.clientActivity = 1;
        } else {
            this.model.setValue('\n'.repeat(14));
            this.clientActivity = 0;
        }
        this.channel = `/${boardId}/content`;
        this.heartbeatChannel = `/${boardId}/heartbeat`;
        this.languageChannel = `/${boardId}/language`;
        this.selectionsChannel = `/${boardId}/selections`;
        this.isRemoteEditInProgress = false;
        this.clientId = Utils.uuidv4();
        this.pubSubClient = pubSubClient;
        this.handleIncomingMessage = this.handleIncomingMessage.bind(this);
        this.handleIncomingSelections = this.handleIncomingSelections.bind(this);
        this.onDidChangeContent = this.onDidChangeContent.bind(this);
        this.onDidChangeCursorSelection = this.onDidChangeCursorSelection.bind(this);
        this.publishSyncAndScheduleNext = this.publishSyncAndScheduleNext.bind(this);
        this.model.onDidChangeContent(this.onDidChangeContent);
        this.editor.onDidChangeCursorSelection(this.onDidChangeCursorSelection);
        this.remoteSelectionDecorationId = '';
        this.isLocalSelectionPublished = false;
    }

    public start(): void {
        this.contentSubscription = this.pubSubClient.subscribe(this.channel, this.handleIncomingMessage);
        this.selectionsSubscription = this.pubSubClient.subscribe(
            this.selectionsChannel,
            this.handleIncomingSelections);
        this.publishSyncAndScheduleNext();
        this.sendHeartbeat(500);
    }

    public stop(): void {
        if (this.contentSubscription) {
            this.contentSubscription.cancel();
        }
        if (this.selectionsSubscription) {
            this.selectionsSubscription.cancel();
        }
        clearTimeout(this.syncTimer);
        clearTimeout(this.heartbeatTimer);
    }

    // TODO heartbeat transmission should be a separate class / function
    private sendHeartbeat(delayMillis: number = 0): void {
        clearTimeout(this.heartbeatTimer);
        this.heartbeatTimer = window.setTimeout(
            () => {
                this.pubSubClient.publish(this.heartbeatChannel, { clientId: this.clientId });
                this.sendHeartbeat(SyncEngine.HEARTBEAT_DURATION);
            },
            delayMillis
        );
    }

    // Extract selection handling in separate class
    private onDidChangeCursorSelection(e: monaco.editor.ICursorSelectionChangedEvent) {
        if (this.isRemoteEditInProgress) {
            return;
        }

        const hasLocalSelection = !e.selection.isEmpty();
        if (hasLocalSelection) {
            // update our selection on remote boards
            this.removeRemoteSelection();
            this.publishSelection(e);
            this.isLocalSelectionPublished = true;
        } else if (this.isLocalSelectionPublished) {
            // discard our selection on remote boards by sending an empty selection
            this.publishSelection(e);
            this.isLocalSelectionPublished = false;
        }
    }

    private publishSelection(e: monaco.editor.ICursorSelectionChangedEvent) {
        this.pubSubClient.publish(this.selectionsChannel, {
            clientId: this.clientId,
            selection: e.selection
        });
    }

    private discardOwnSelection() {
        const hasLocalSelection = !this.editor.getSelection().isEmpty();
        if (hasLocalSelection) {
            const pos = this.editor.getPosition();
            const emptySelectionAtPosition = new monaco.Selection(
                pos.lineNumber, pos.column, pos.lineNumber, pos.column
            );
            this.editor.setSelection(emptySelectionAtPosition);
        }
    }

    private updateRemoteSelection(selection: monaco.Selection) {
        const decorationIds = this.model.deltaDecorations(
            [this.remoteSelectionDecorationId],
            [{
                range: selection,
                options:
                    {
                        className: 'remoteSelectionDecoration',
                        hoverMessage: 'Selection by remote user.',
                        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                    }
            }]
        );
        this.remoteSelectionDecorationId = decorationIds[0];
    }

    private removeRemoteSelection() {
        this.model.deltaDecorations([this.remoteSelectionDecorationId], []);
        this.remoteSelectionDecorationId = '';
    }

    private handleIncomingSelections(message: { clientId: string, selection: monaco.Selection }) {
        if (message.clientId === this.clientId) {
            return;
        }

        if (!monaco.Range.isEmpty(message.selection)) {
            this.discardOwnSelection();
            this.updateRemoteSelection(message.selection);
        } else {
            this.removeRemoteSelection();
        }
    }

    private handleIncomingMessage(message: Message): void {
        if (message.clientId === this.clientId) {
            return;
        }
        if (message.type === 'edit') {
            this.handleIncomingEditMessage(message as EditMessage);
        } else {
            if (message.type === 'sync') {
                this.handleIncomingSyncMessage(message as SyncMessage);
            }
        }
    }

    private handleIncomingEditMessage(message: EditMessage) {
        try {
            this.isRemoteEditInProgress = true;

            // Do not modify the undo stack on incoming edits. The user is only expecting to undo his edits.
            this.model.applyEdits(message.edits);
        }
        finally {
            this.isRemoteEditInProgress = false;
        }

        // Drop own selection if it was modified by remote edits
        const selection = this.editor.getSelection();
        message.edits.forEach((edit) => {
            if (monaco.Range.areIntersectingOrTouching(edit.range, selection)) {
                this.discardOwnSelection();
            }
        });
    }

    private handleIncomingSyncMessage(message: SyncMessage) {
        if (message.clientActivity <= 1) {
            // Immediately transmit heartbeat if new client is detected
            this.pubSubClient.publish(this.heartbeatChannel, { clientId: this.clientId });
        }

        const ourContent = this.model.getValue();
        if (message.content !== ourContent) {
            if (this.clientActivity <= message.clientActivity) {
                // We received content from a more active client. Let's accept it.
                try {
                    this.isRemoteEditInProgress = true;
                    this.model.setValue(message.content);
                }
                finally {
                    this.isRemoteEditInProgress = false;
                }
                this.clientActivity = message.clientActivity;
            } else {
                // We received out-dated content. Share our content.
                this.publishSyncAndScheduleNext();
            }
        } else {
            this.clientActivity = message.clientActivity;
        }
        // We just sync'ed. Let's postpone the next sync request.
        this.postponeSync();
    }

    private onDidChangeContent(event: monaco.editor.IModelContentChangedEvent) {
        this.clientActivity += 1;
        this.postponeSync();
        if (!this.isRemoteEditInProgress) {
            this.publishEdits(changesToEdits(event.changes));
        }
    }

    private publishEdits(edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
        this.pubSubClient.publish(this.channel, this.createEditMessage(edits));
    }

    private createEditMessage(edits: monaco.editor.IIdentifiedSingleEditOperation[]): EditMessage {
        return {
            clientId: this.clientId,
            type: 'edit',
            edits: edits
        };
    }

    private postponeSync() {
        clearTimeout(this.syncTimer);
        this.syncTimer = window.setTimeout(
            this.publishSyncAndScheduleNext,
            SyncEngine.SYNC_TIMEOUT + Math.random() * 1000);
    }

    private publishSyncAndScheduleNext() {
        this.pubSubClient.publish(this.channel, this.createSyncMessage());
        this.pubSubClient.publish(this.languageChannel, this.model.getModeId());
        this.postponeSync();
    }

    private createSyncMessage(): SyncMessage {
        return {
            clientId: this.clientId,
            type: 'sync',
            clientActivity: this.clientActivity,
            content: this.model.getValue(),
        };
    }
}

export default SyncEngine;