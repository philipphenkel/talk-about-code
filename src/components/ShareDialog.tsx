import * as React from 'react';
import FlatButton from 'material-ui/FlatButton';
import Dialog from 'material-ui/Dialog';

interface ShareDialogProps {
    open: boolean;
    onClose(): void;
}

export default class ShareDialog extends React.Component<ShareDialogProps, {}> {

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
                title="LINK COPIED TO CLIPBOARD"
                actions={actions}
                modal={false}
                open={this.props.open}
                onRequestClose={this.props.onClose}
            >
                <p>
                    The link to both this board and its current content has been copied to the clipboard.
                </p>
                <p>
                    The board's content is stored as part of its web address.
                    We are continously encoding the content and updating the 
                    location bar after a short period of inactivity.
                    We do not persist your code conversations on our servers.
                </p>
                Please share the link and have a fruitful discussion about your code.
            </Dialog>
        );
    }
}
