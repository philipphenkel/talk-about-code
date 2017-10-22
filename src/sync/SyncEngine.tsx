import { uuidv4 } from './utils';

function changeToEdit(change: any): monaco.editor.IIdentifiedSingleEditOperation {
    return {
        identifier: { major: 1, minor: 0 },
        range: change.range,
        text: change.text,
        forceMoveMarkers: false
    };
}

function changesToEdits(changes: any[]): monaco.editor.IIdentifiedSingleEditOperation[] {
    return changes.map(changeToEdit);
}

interface EditMessage {
    clientId: string;
    type: string;
    edits: monaco.editor.IIdentifiedSingleEditOperation[];
}

interface SyncMessage {
    clientId: string;
    type: string;
    clientActivity: number;
    content: string;
}

class SyncEngine {
    private static readonly SYNC_TIMEOUT: number = 5000;

    private editor: monaco.editor.ICodeEditor;
    private model: monaco.editor.IModel;
    private pubSubClient: any;

    private channel: string;
    private clientId: string;
    private clientActivity: number;
    private isRemoteChangeInProgress: boolean;
    private syncTimer: number;

    constructor(
        editor: monaco.editor.ICodeEditor,
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
            this.clientActivity = 0;
        }
        this.channel = '/' + boardId;
        this.isRemoteChangeInProgress = false;
        this.clientId = uuidv4();
        this.pubSubClient = pubSubClient;
        this.pubSubClient.subscribe(this.channel, this.handleIncomingMessage.bind(this));
        this.model.onDidChangeContent(this.handleContentChange.bind(this));
        this.publishSyncAndScheduleNext = this.publishSyncAndScheduleNext.bind(this);
        this.publishSyncAndScheduleNext();
    }

    handleIncomingMessage(message: any): void {
        if (message.clientId === this.clientId) {
            return;
        }

        if (message.type === 'edit') {
            this.handleIncomingEditMessage(message);
        } else {
            if (message.type === 'sync') {
                this.handleIncomingSyncMessage(message);
            }
        }
    }

    handleIncomingEditMessage(message: EditMessage) {
        this.isRemoteChangeInProgress = true;

        // Do not modify the undo stack on incoming edits. The user is only expecting to undo his edits.
        this.model.applyEdits(message.edits);

        // Drop selection if it was modified by remote edits
        const selection = this.editor.getSelection();
        message.edits.forEach((edit) => {
            if (monaco.Range.areIntersectingOrTouching(edit.range, selection)) {
                const pos = this.editor.getPosition();
                this.editor.setPosition(pos);
            }
        });

        this.isRemoteChangeInProgress = false;
    }

    handleIncomingSyncMessage(message: SyncMessage) {
        const ourContent = this.model.getValue();
        if (message.content !== ourContent) {
            if (this.clientActivity <= message.clientActivity) {
                // We received content from a more active client. Let's accept it.
                console.log('sync: accept remote content');
                this.isRemoteChangeInProgress = true;
                this.model.setValue(message.content);
                this.isRemoteChangeInProgress = false;
                this.clientActivity = message.clientActivity;
            } else {
                // We received out-dated content. Share our content.
                console.log('sync: share our content');
                this.publishSyncAndScheduleNext();
            }
        } else {
            console.log('sync: no difference');
        }
        // We just sync'ed. Let's postpone the next sync request.
        this.postponeSync();
    }

    handleContentChange(event: any) {
        this.clientActivity += 1;
        this.postponeSync();
        if (!this.isRemoteChangeInProgress) {
            this.publishEdits(changesToEdits(event.changes));
        }
    }

    publishEdits(edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
        this.pubSubClient.publish(this.channel, this.createEditMessage(edits));
    }

    createEditMessage(edits: monaco.editor.IIdentifiedSingleEditOperation[]): EditMessage {
        return {
            clientId: this.clientId,
            type: 'edit',
            edits: edits
        };
    }

    postponeSync() {
        clearTimeout(this.syncTimer);
        this.syncTimer = window.setTimeout(
            this.publishSyncAndScheduleNext,
            SyncEngine.SYNC_TIMEOUT + Math.random() * 1000);
    }

    publishSyncAndScheduleNext() {
        this.pubSubClient.publish(this.channel, this.createSyncMessage());
        this.postponeSync();
    }

    createSyncMessage(): SyncMessage {
        return {
            clientId: this.clientId,
            type: 'sync',
            clientActivity: this.clientActivity,
            content: this.model.getValue(),
        };
    }
}

export default SyncEngine;