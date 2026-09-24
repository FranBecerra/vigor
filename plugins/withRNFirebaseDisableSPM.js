/**
 * Config plugin local: desactiva SPM en React Native Firebase.
 *
 * ¿Por qué? RN Firebase v26 resuelve el SDK de Firebase por Swift Package
 * Manager (SPM). Con `useFrameworks: static` (que Firebase necesita en iOS),
 * SPM + static linkage produce símbolos duplicados y `pod install` falla.
 *
 * La solución recomendada por RN Firebase es fijar la global `$RNFirebaseDisableSPM = true`
 * ANTES de cualquier target en el Podfile, para que Firebase se resuelva por
 * CocoaPods (compatible con static linkage).
 *
 * Un "config plugin" es una función que Expo ejecuta durante `expo prebuild`
 * para modificar los archivos nativos generados. Así este ajuste se reaplica
 * solo cada vez que se regenera el Podfile, sin editarlo a mano.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const LINE = '$RNFirebaseDisableSPM = true';

module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(LINE)) {
        // Insertar la global al principio del Podfile, antes de cualquier target.
        contents = `${LINE}\n${contents}`;
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
