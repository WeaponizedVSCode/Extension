// export EdgeInfoComponents  to window
// replace all 'const classes = useHelpTextStyles();'
// with following code to avoid react hooks error
const classes = {
    containsCodeEl: {
        '& code': {
            backgroundColor: "white",
            padding: '2px .5ch',
            fontWeight: 'normal',
            fontSize: '.875em',
            borderRadius: '3px',
            display: 'inline',

            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
        },
    },
};
// export EdgeInfoComponents to window
console.log('EdgeInfoComponents loaded successfully');
window.EdgeInfoComponents = EdgeInfoComponents; // Expose for debugging in browser console

// grep 'swicth' will found
// ./Owns/WindowsAbuse.tsx:30:    switch (targetType) {
// ./Owns/LinuxAbuse.tsx:27:    switch (targetType) {
// ./AllExtendedRights/WindowsAbuse.tsx:22:    switch (targetType) {
// ./AllExtendedRights/LinuxAbuse.tsx:22:    switch (targetType) {
// ./GenericAll/WindowsAbuse.tsx:30:    switch (targetType) {
// ./GenericAll/LinuxAbuse.tsx:27:    switch (targetType) {
// ./WriteDacl/WindowsAbuse.tsx:30:    switch (targetType) {
// ./WriteDacl/LinuxAbuse.tsx:27:    switch (targetType) {
// ./GenericWrite/WindowsAbuse.tsx:22:    switch (targetType) {
// ./GenericWrite/LinuxAbuse.tsx:22:    switch (targetType) {
// ./WriteOwner/WindowsAbuse.tsx:30:    switch (targetType) {
// ./WriteOwner/LinuxAbuse.tsx:22:    switch (targetType) {


// and open devtools in chrome dump in frontend console:
console.clear();
console.debug("begin processing")
let bruteforcer = [
  "Owns",
  "AllExtendedRights",
  "GenericAll",
  "WriteDacl",
  "GenericWrite",
  "WriteOwner",
];
let targetTypes = [
  'CertTemplate','Computer','Container','Domain','EnterpriseCA','GPO','Group','IssuancePolicy','NTAuthStore','OU','RootCA','User'
]
let technique_json = [];
function attrbuteCheck(technique, tech, name) {
    if(!tech) {
        return {};
    };
    if(!tech[name]) {
        return {};
    };
  let func = tech[name];
  let gen = undefined;
  try {
    let flag = false;
    for (const f of bruteforcer) {
      if (technique === f) {
        flag = true;
        break
      }
    }
    if (flag && name.includes("Abuse")) {
        console.debug(`This technique need brute force, please check it manually.`);
        gen = []
        for (let targetType of targetTypes) {
          reactObj = func({
            sourceType: undefined,
            sourceName: "WE_CONTROLLED",
            targetName: "OUR_TARGET",
            targetType: targetType,
          }); 
          if (JSON.stringify(reactObj).includes("No abuse information")) {
            console.debug(`No abuse information for ${technique} ${name} ${targetType}`);
            continue;
          }
          gen.push([targetType, reactObj]);
        }
    } else {
      console.debug(`processing ${technique}[${name}]... `)
      gen = func({
          sourceType: undefined,
          sourceName: "WE_CONTROLLED",
          targetName: "OUR_TARGET",
      });
    }
    return gen;
  } catch (e) {
    var func_str = func.toString().split("\n")
    console.debug(`${technique}'s ${name} func has params ${func_str[0]} ${func_str[1]} ${func_str[2]}`);
    console.debug(e);
    return {};
  }
}
for (const technique of Object.keys(EdgeInfoComponents)) {
  let tech = EdgeInfoComponents[technique];
  technique_json.push({
    technique: technique,
    windows: attrbuteCheck(technique, tech, "windowsAbuse"),
    linux: attrbuteCheck(technique, tech, "linuxAbuse"),
    abuse: attrbuteCheck(technique, tech, "abuse"),
    general: attrbuteCheck(technique, tech, "general"),
  });
}
console.log(JSON.stringify(technique_json));
