import * as React from 'react';
import FlatButton from 'material-ui/FlatButton';
import Dialog from 'material-ui/Dialog';

interface SaveDialogProps {
    open: boolean;
    onClose(): void;
}

export default class SaveDialog extends React.Component<SaveDialogProps, {}> {

    public render() {
        const actions = [(
            <FlatButton
                key="1"
                label="Awesome!"
                primary={true}
                onClick={this.props.onClose}
            />
        )];

        return (
            <Dialog
                title="BOOKMARK YOUR PAGE"
                actions={actions}
                modal={false}
                open={this.props.open}
                onRequestClose={this.props.onClose}
            >
                <p>
                    The board's content is stored as part of its web address.
                    We are continously encoding the content and updating the 
                    location bar after a short period of inactivity.
                    We do not persist your code conversations on our servers.
                </p>
                Please bookmark your board to save it.
            </Dialog>
        );
    }
}
