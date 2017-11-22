import * as React from 'react';
import FontIcon from 'material-ui/FontIcon';
import IconButton from 'material-ui/IconButton';
import { white, red400 } from 'material-ui/styles/colors';
import { Utils } from '../Utils';

interface ConnectionStatusProps {
    pubSubClient: any;
}

interface ConnectionStatusState {
    hasConnectionFeedback: boolean;
    isConnected: boolean;
    userCount: number;
    userId: string;
}

export default class ConnectionStatus extends React.Component<ConnectionStatusProps, ConnectionStatusState> {

    constructor(props: ConnectionStatusProps) {
        super(props);

        this.state = {
            hasConnectionFeedback: false,
            isConnected: false,
            userCount: 1,
            userId: Utils.uuidv4(),
        };

        props.pubSubClient.on('transport:up', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: true });
        });

        props.pubSubClient.on('transport:down', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: false });
        });
    }

    public render() {
        let tooltip = 'Connecting to sync server';
        let icon = 'sync';
        let color = white;

        if (this.state.hasConnectionFeedback) {
            if (this.state.isConnected) {
                if (this.state.userCount <= 1) {
                    icon = 'person';
                    tooltip = 'You are the only user of this board';
                } else {
                    icon = 'people';
                    tooltip = `${this.state.userCount} users on this board`;
                }
            } else {
                icon = 'sync_problem';
                tooltip = 'Not connected to sync server';
                color = red400;
            }
        }

        return (
            <div>
                <IconButton
                    disableTouchRipple={true}
                    tooltip={tooltip}
                    tooltipPosition="bottom-left"
                >
                    <FontIcon
                        className="material-icons"
                        color={color}
                    >
                        {icon}
                    </FontIcon>
                </IconButton>
            </div>
        );
    }
}
