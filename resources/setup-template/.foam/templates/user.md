---
title: ${1:$TM_FILENAME_BASE}
type: user
tag: ${FOAM_TITLE/^(\S*)@//}
foam_template:
  filepath: 'users/$FOAM_TITLE/$FOAM_TITLE.md'
  name: 'user'
  description: 'note when getting a user'
---

### ${1:$TM_FILENAME_BASE}

#### validated credentials

```yaml credentials
- login: ${FOAM_TITLE/^(\S*)@//}
  user: ${FOAM_TITLE/@(\S*)$//}
  password: pass
  nt_hash: fffffffffffffffffffffffffffffffffff
  is_current: false
  props:
    key: value
    ENV_KEY: exported_in_env
```

```zsh

```

#### information

1. 
2. 
3. 

#### Privileges / roles / groups 






