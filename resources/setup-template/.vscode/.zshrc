# Start the virtual environment if exists
if [ -d "$PROJECT_FOLDER/venv" ]; then
    if [ -n "${VIRTUAL_ENV}" ]; then
        # sliently deactivate the virtual environment

        # echo "Virtual Environment is already activated."
        # echo "Virtual Environment Home: ${VIRTUAL_ENV}"
        # echo "Trying to deactivate the virtual environment automatically."

        # force deactivate the virtual environment
        if [ -n "${_OLD_VIRTUAL_PATH:-}" ]; then
            PATH="${_OLD_VIRTUAL_PATH:-}"
            export PATH
            unset _OLD_VIRTUAL_PATH
        fi
        if [ -n "${_OLD_VIRTUAL_PYTHONHOME:-}" ]; then
            PYTHONHOME="${_OLD_VIRTUAL_PYTHONHOME:-}"
            export PYTHONHOME
            unset _OLD_VIRTUAL_PYTHONHOME
        fi
        if [ -n "${BASH:-}" -o -n "${ZSH_VERSION:-}" ]; then
            hash -r 2>/dev/null
        fi
        if [ -n "${_OLD_VIRTUAL_PS1:-}" ]; then
            PS1="${_OLD_VIRTUAL_PS1:-}"
            export PS1
            unset _OLD_VIRTUAL_PS1
        fi
        unset VIRTUAL_ENV
        unset VIRTUAL_ENV_PROMPT
        if [ ! "${1:-}" = "nondestructive" ]; then
            # deactivate always useless here
            # unset -f deactivate
        fi
    fi

    source $PROJECT_FOLDER/venv/bin/activate
fi

# change hist file location in project.
HISTSIZE=100000000
SAVEHIST=100000000
if [[ "$HIST_COMMAND_INDEXER" != "" ]]; then
    if [[ ! -f ${HIST_COMMAND_INDEXER} ]]; then
        echo "HIST_COMMAND_INDEXER file not found: ${HIST_COMMAND_INDEXER}"
    else
        fc -R -I ${HIST_COMMAND_INDEXER} # loading the command indexer
    fi
fi


function differ() {
        if [[ -z $1 || -z $2 ]]; then
                echo "Usage: differ <file1> <file2>"
                return 1
        fi
        if [[ ! -f $1 || ! -f $2 ]]; then
                echo "File not found!"
                return 1
        fi
        code -d "$1" "$2"
}

# unset -f wfuzz_vhost_https
function wfuzz_vhost_https() {
        local host=$1
        local wordlist=$2
        if [[ -z $wordlist ]] || [[ -z $host ]]; then
                echo "Usage: wfuzz_vhost <host> <wordlist> [wfuzz options]"
                return
        fi
        wfuzz -c -w $wordlist -H "Host: FUZZ.$host" -u "https://$host" $3 $4 $5 $6 $7 $8 $9 $10 $11 $12 $13 $14 $15 $16 $17 $18 $19
}

function ntlm() {
        if [ -n "$1" ]; then
                python3 -c 'import hashlib,binascii;hash = hashlib.new("md4", "'$1'".encode("utf-16le")).digest();print(binascii.hexlify(hash).decode("utf-8"))'
                if [[ $? -ne 0 ]]; then
                        echo "Error: ntlm hash generation failed. "
                        echo "if not support md4 hash, please check your openssl config."
                        return 1
                fi
        else
                echo "usage: $0 password"
        fi
}

function wfuzz_vhost_http() {
        local host=$1
        local wordlist=$2
        if [[ -z $wordlist ]] || [[ -z $host ]]; then
                echo "Usage: wfuzz_vhost <host> <wordlist> [wfuzz options]"
                return
        fi
        wfuzz -c -w $wordlist -H "Host: FUZZ.$host" -u "http://$host" $3 $4 $5 $6 $7 $8 $9 $10 $11 $12 $13 $14 $15 $16 $17 $18 $19
}

function url() {
        case "$1" in
        h | -h | help | --help)
                which $0
                ;;
        decode | d | -d | --decode) if [ -z "$2" ]; then
                \python3 -c "import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read()));"
        else
                \python3 -c "import sys; from urllib.parse import unquote; print(unquote(' '.join(sys.argv[2:])));" "$@"
        fi ;;
        encode | e | -e | --encode) if [ -z "$2" ]; then
                \python3 -c "import sys; from urllib.parse import quote; print(quote(sys.stdin.read()[:-1]));"
        else
                \python3 -c "import sys; from urllib.parse import quote; print(quote(' '.join(sys.argv[2:])));" "$@"
        fi ;;
        esac
}

function proxys() {
        export Proxy="127.0.0.1" # define as your favour
        export ProxyPort="7890"  # define as your favour
        case "$1" in
        h)
                echo "|==============================================|"
                echo "|                proxys Usage                  |"
                echo "|         ---- fast commandline proxy switcher |"
                echo "|==============================================|"
                echo "| Basic Usage: proxys [SubCommand] [param1]    |"
                echo "|==============================================|"
                echo "|                Sub Command List              |"
                echo "|==============================================|"
                echo "| proxy [proxy_ip]          import ip temply   |"
                echo "| port [port_id]            import port temply |"
                echo "| loc                       import localhost   |"
                echo "| set [protocol]://[proxy_ip]:[port] set proxy |"
                echo "| on                        up the cli proxy   |"
                echo "| off                       down the proxy     |"
                echo "| *                         show proxy setting |"
                echo "| h/help                    show help          |"
                echo "|==============================================|"
                ;;
        set)
                if [ -z "$2" ]; then
                        echo "Usage: $0 set [protocol]://[proxy_ip]:[port]"
                        echo "Example: $0 set http://127.0.0.1:8080"
                else
                        export http_proxy="$2" \
                                https_proxy="$2" \
                                all_proxy="$2" &&
                                echo "export Proxy complete" && $0 show
                fi
                ;;
        proxy)
                export Proxy="$2"
                ;;
        port)
                export ProxyPort="$2"
                ;;
        loc)
                export Proxy="127.0.0.1" # define as your favour
                export ProxyPort="7890"  # define as your favour
                $0 on
                ;;
        on)
                export https_proxy=http://$Proxy:$ProxyPort \
                        http_proxy=http://$Proxy:$ProxyPort &&
                        echo 'export Proxy complete' && $0 show
                ;;
        off)
                unset https_proxy http_proxy all_proxy && echo 'unset Proxy complete'
                ;;
        help)
                proxys h
                ;;
        *)
                echo "Current Proxy Condition like ...."
                export | grep proxy
                echo "if you can't see any output like 'XX_PROXY=' there"
                echo "That means no proxy is set"
                ;;
        esac
}

function current_status() {
        if [[ -z $CURRENT_RHOST ]]; then
                echo "No current host set."
        else
                echo "Current Host: ${TARGET} => ${DOMAIN} (${RHOST}) ${DC_HOST} ${DC_IP}"
        fi
        if [[ -z $CURRENT_USER ]]; then
                echo "No current user set."
        else
                echo "Current User: ${USER} => ${USER}:${PASS} (${NT_HASH})"
        fi
}