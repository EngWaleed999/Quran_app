 export type AppFontPreset = 'sans';                                                                                            
    export const ACTIVE_FONT_PRESET: AppFontPreset = 'sans';                                                                       
                                                                                                                                   
    export const THMANYAH_FONTS = {                                                                                                
      'ThmanyahSans-Light': require('../../../assets/fonts/thmanyah_typeface/thmanyahsans/otf/thmanyahsans_Light.otf'),            
      'ThmanyahSans-Regular': require('../../../assets/fonts/thmanyah_typeface/thmanyahsans/otf/thmanyahsans_Regular.otf'),        
      'ThmanyahSans-Medium': require('../../../assets/fonts/thmanyah_typeface/thmanyahsans/otf/thmanyahsans_Medium.otf'),          
      'ThmanyahSans-Bold': require('../../../assets/fonts/thmanyah_typeface/thmanyahsans/otf/thmanyahsans_Bold.otf'),              
      'ThmanyahSans-Black': require('../../../assets/fonts/thmanyah_typeface/thmanyahsans/otf/thmanyahsans_Black.otf'),            
    };                                                                                                                             
                                                                                                                                   
    export type FontStyleWeight = 'light' | 'regular' | 'medium' | 'bold' | 'black';                                               
                                                                                                                                   
    export function getAppFont(weight: FontStyleWeight = 'regular'): string {                                                      
      switch (weight) {                                                                                                            
        case 'light': return 'ThmanyahSans-Light';                                                                                 
        case 'medium': return 'ThmanyahSans-Medium';                                                                               
        case 'bold': return 'ThmanyahSans-Bold';                                                                                   
        case 'black': return 'ThmanyahSans-Black';                                                                                 
        case 'regular':                                                                                                            
        default:                                                                                                                   
          return 'ThmanyahSans-Regular';                                                                                           
      }                                                                                                                            
    }                             