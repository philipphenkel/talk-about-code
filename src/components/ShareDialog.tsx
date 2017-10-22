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
                title="COPIED TO CLIPBOARD"
                actions={actions}
                modal={false}
                open={this.props.open}
                onRequestClose={this.props.onClose}
            >
                <p>
                    The link to both this board and its current content has been copied to the clipboard. 
                </p>
                Please share the link and have a fruitful discussion about your code.
            </Dialog>
        );
    }
}
