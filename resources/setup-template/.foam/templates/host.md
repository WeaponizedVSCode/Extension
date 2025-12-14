---
title: ${1:$TM_FILENAME_BASE}
type: host
foam_template:
  filepath: 'hosts/$FOAM_TITLE/$FOAM_TITLE.md'
  name: 'host'
  description: 'note when hacking a host'
---

### ${1:$TM_FILENAME_BASE}

#### host location

```yaml host
- hostname: ${1:$TM_FILENAME_BASE}
  is_dc: false
  ip: 10.10.10.10
  alias: ["${1:$TM_FILENAME_BASE}"] # if is DC, please set the dc hostname as the first alias, such as ["dc01.example.com"]
  is_current: false
  is_current_dc: false
  props: 
    key: value
    ENV_KEY: exported_in_env
```

```zsh 

```

#### ports

##### 80

#### information

1. Linux/Windows
2. Kernel version
3. ...

##### Nmap
```

```

#### vulnerabilities / exploits

privsec problem with user xxxx and using exploit 

#### related information

##### services

##### users

#### proof

local proof? machine proof? screenshot?
