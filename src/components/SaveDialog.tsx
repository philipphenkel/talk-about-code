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
                title="ADMIN LINK COPIED TO CLIPBOARD"
                actions={actions}
                modal={false}
                open={this.props.open}
                onRequestClose={this.props.onClose}
            >
                <p>
                    The link to both this board and its current content has been copied to the clipboard.
                </p>
                <p>
                    We store the board's content as part of its web address.
                    After a short period of inactivity, we are encoding the content and updating the 
                    location bar.
                    We do not persist your code conversations on our servers.
                </p>

                Please save the admin link if you would like to restore this board later.
            </Dialog>
        );
    }
}
