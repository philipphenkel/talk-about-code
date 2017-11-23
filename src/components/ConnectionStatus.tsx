import * as React from 'react';
import FontIcon from 'material-ui/FontIcon';
import IconButton from 'material-ui/IconButton';
import { white, red400 } from 'material-ui/styles/colors';
import CircularProgress from 'material-ui/CircularProgress';

interface ConnectionStatusProps {
    pubSubClient: any;
    clientId: string;
}

interface ConnectionStatusState {
    hasConnectionFeedback: boolean;
    isConnected: boolean;
    userCount: number;
}

export default class ConnectionStatus extends React.Component<ConnectionStatusProps, ConnectionStatusState> {

    constructor(props: ConnectionStatusProps) {
        super(props);

        this.state = {
            hasConnectionFeedback: false,
            isConnected: false,
            userCount: 1,
        };

        props.pubSubClient.on('transport:up', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: true });
        });

        props.pubSubClient.on('transport:down', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: false });
        });
    }

    public render() {
        let symbol = <CircularProgress size={20} color={white} thickness={3}/>;
        let tooltip = 'Connecting to sync server';
        
        if (this.state.hasConnectionFeedback) {
            if (this.state.isConnected) {
                if (this.state.userCount <= 1) {
                    tooltip = 'Waiting for other users';
                } else {
                    symbol = <FontIcon className="material-icons" color={white}>people</FontIcon>;
                    tooltip = `${this.state.userCount} users on this board`;
                }
            } else {
                symbol = <FontIcon className="material-icons" color={red400}>error</FontIcon>;
                tooltip = 'Not connected to sync server';
            }
        }

        return (
            <div>
                <IconButton
                    disableTouchRipple={true}
                    tooltip={tooltip}
                    tooltipPosition="bottom-center"
                >
                   {symbol}
                </IconButton>
            </div>
        );
    }
}
