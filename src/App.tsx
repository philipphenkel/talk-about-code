import * as React from 'react';
import './App.css';
import MonacoEditor from 'react-monaco-editor';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import { MuiTheme } from 'material-ui/styles';
import { TouchTapEvent } from 'material-ui';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import { blue600 } from 'material-ui/styles/colors';
import FlatButton from 'material-ui/FlatButton';
import DropDownMenu from 'material-ui/DropDownMenu';
import MenuItem from 'material-ui/MenuItem';
import { Toolbar, ToolbarGroup, ToolbarTitle } from 'material-ui/Toolbar';
import { withRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';
import ShareDialog from './components/ShareDialog';
import SaveDialog from './components/SaveDialog';
import SyncEngine from './sync/SyncEngine';
import { uuidv4 } from './sync/utils';
import * as Clipboard from 'clipboard';

const faye = require('faye');
const fayeClient = new faye.Client('https://faye.brickcoder.com/bayeux');

fayeClient.on('transport:up', () => {
  console.log('transport:up');
});

fayeClient.on('transport:down', () => {
  console.log('transport:down');
});

enum Role {
  User = 'user',
  Admin = 'admin',
}

class App extends React.Component<any, any> {

  private editor: monaco.editor.ICodeEditor;
  private muiTheme: MuiTheme;
  private syncEngine: SyncEngine;
  private clipBoard: Clipboard;
  private hashUpdateTimer: number;

  constructor(props: any) {
    super(props);

    this.onCopyToClipboard = this.onCopyToClipboard.bind(this);
    this.onCloseShareDialog = this.onCloseShareDialog.bind(this);
    this.onCloseSaveDialog = this.onCloseSaveDialog.bind(this);
    this.onSelectLanguage = this.onSelectLanguage.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onEditorChange = this.onEditorChange.bind(this);
    this.refreshBoardConfigInUrl = this.refreshBoardConfigInUrl.bind(this);
    this.createUrlPath = this.createUrlPath.bind(this);

    this.state = {
      languages: ['javascript'],
      selectedLanguage: 0,
      isShareDialogOpen: false,
      isSaveDialogOpen: false,
      boardId: '',
      role: Role.User,
    };

    this.muiTheme = getMuiTheme({
      palette: {
        primary1Color: blue600,
      },
      toolbar: {
        height: 65,
        backgroundColor: '#26556D',
      }
    });
  }

  onResize() {
    if (this.editor) {
      this.editor.layout();
    }
  }

  onSelectLanguage(event: TouchTapEvent, index: number, value: string) {
    this.setState({ selectedLanguage: value });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize.bind(this));
    this.clipBoard = new Clipboard('.shareBoardButton', { text: this.onCopyToClipboard });
  }

  componentWillUnmount() {
    this.clipBoard.destroy();
    window.removeEventListener('resize', this.onResize.bind(this));
  }

  editorDidMount(editor: monaco.editor.ICodeEditor) {
    console.log('editorDidMount');

    this.editor = editor;
    this.editor.focus();

    console.log('location ' + JSON.stringify(this.props.location));

    // Parse URL <host>/board/<boardId>#<content_base64>
    const loc = this.props.location;
    const pathArray = loc.pathname.split('/');
    let boardId = '';
    let boardContent = '';
    let role = Role.Admin;
    let language = editor.getModel().getModeId();

    if (pathArray.length === 3 && pathArray[1] === 'board' && pathArray[2] !== '') {
      // connect to existing board
      boardId = pathArray[2];

      // apply board config
      if (loc.hash !== '') {
        const encodedHashValue = loc.hash.slice(1);
        const boardConfig = JSON.parse(this.atou(encodedHashValue));
        boardContent = boardConfig.content;
        role = boardConfig.role;
        language = boardConfig.language;
      }
    } else {
      // create new board
      boardId = uuidv4();
    }

    this.syncEngine = new SyncEngine(editor, fayeClient, boardId, boardContent);

    var languages = monaco.languages
      .getLanguages()
      .map(function (lang: monaco.languages.ILanguageExtensionPoint) { return lang.id; });
    // languages.sort();

    const path = this.createUrlPath(boardId, role, editor.getModel().getModeId(), editor.getValue());
    this.props.history.replace(path);

    this.setState({
      selectedLanguage: languages.indexOf(language),
      languages: languages,
      boardId: boardId,
      role: role
    });
  }

  createUrlPath(boardId: string, role: Role, language: string, content: string) {
    const hashValue = { role, language, content };
    return '/board/' + boardId + '#' + this.utoa(JSON.stringify(hashValue));
  }

  refreshBoardConfigInUrl() {
    const newUrl = this.createUrlPath(
      this.state.boardId,
      this.state.role,
      this.editor.getModel().getModeId(),
      this.editor.getValue()
    );
    this.props.history.replace(newUrl);
  }

  // ucs-2 string to base64 encoded ascii
  utoa(str: string) {
    return window.btoa(encodeURIComponent(str));
  }
  // base64 encoded ascii to ucs-2 string
  atou(str: string) {
    return decodeURIComponent(window.atob(str));
  }

  onCopyToClipboard(elem: Element): string {
    this.setState({ isShareDialogOpen: true });

    if (this.editor) {
      const path = this.createUrlPath(
        this.state.boardId,
        Role.User,
        this.editor.getModel().getModeId(),
        this.editor.getValue()
      );
      return window.location.host + path;
    } else {
      return '';
    }
  }

  onSave() {
    this.setState({ isSaveDialogOpen: true });
  }

  onCloseShareDialog() {
    this.setState({ isShareDialogOpen: false });
  }

  onCloseSaveDialog() {
    this.setState({ isSaveDialogOpen: false });
  }

  onEditorChange(event: any) {
    clearTimeout(this.hashUpdateTimer);
    this.hashUpdateTimer = window.setTimeout(
      this.refreshBoardConfigInUrl,
      2000);
  }

  render() {

    const options = {
      selectOnLineNumbers: true,
      minimap: { enabled: false },
      contextmenu: true,
      folding: false,
      theme: 'vs',
      automaticLayout: false,
      occurrencesHighlight: false,
      selectionHighlight: false,
      scrollBeyondLastLine: false,
      // renderLineHighlight: 'none',
      // lineNumbers: 'on',
      fontFamily: 'Roboto Mono'
    };

    const styles = {
      title: {
        fontFamily: 'Permanent Marker',
        color: 'white',
        fontSize: 30
      },
      button: {
        color: 'white'
      }
    };

    let languageItems: Array<JSX.Element> = [];
    for (let i = 0; i < this.state.languages.length; i++) {
      languageItems.push(<MenuItem value={i} key={i} primaryText={this.state.languages[i].toUpperCase()} />);
    }

    const renderAdminControls = () => {
      if (this.state.role === Role.Admin) {
        return <ToolbarGroup>
          <FlatButton label="New" style={styles.button} containerElement={<Link to="/" target="_blank" />} />
          <FlatButton label="Save" style={styles.button} onClick={this.onSave} />
          <FlatButton className="shareBoardButton" label="Share" style={styles.button} />
          <DropDownMenu
            value={this.state.selectedLanguage}
            labelStyle={styles.button}
            onChange={this.onSelectLanguage}
          >
            {languageItems}
          </DropDownMenu>
        </ToolbarGroup>;
      } else {
        return '';
      }
    };

    return (
      <MuiThemeProvider muiTheme={this.muiTheme}>
        <div className="App">
          <ShareDialog open={this.state.isShareDialogOpen} onClose={this.onCloseShareDialog} />
          <SaveDialog open={this.state.isSaveDialogOpen} onClose={this.onCloseSaveDialog} />
          <Toolbar>
            <ToolbarGroup>
              <ToolbarTitle text="Talk About Code" style={styles.title} />
            </ToolbarGroup>
            {renderAdminControls()}
          </Toolbar>
          <div className="App-editor">
            <MonacoEditor
              options={options}
              language={this.state.languages[this.state.selectedLanguage]}
              editorDidMount={this.editorDidMount}
              onChange={this.onEditorChange}
            />
          </div>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default withRouter<{}>(App);
