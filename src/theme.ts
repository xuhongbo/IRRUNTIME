import { createTheme } from "@mui/material/styles";

// Professional Palette (Slate & Indigo)
const palette = {
  primary: {
    main: "#4f46e5", // Indigo-600
    light: "#818cf8",
    dark: "#3730a3",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#db2777", // Pink-600
    light: "#f472b6",
    dark: "#be185d",
    contrastText: "#ffffff",
  },
  background: {
    default: "#f8fafc", // Slate-50
    paper: "#ffffff",
  },
  text: {
    primary: "#0f172a", // Slate-900
    secondary: "#475569", // Slate-600
    disabled: "#94a3b8", // Slate-400
  },
  divider: "#e2e8f0", // Slate-200
  action: {
    hover: "#f1f5f9", // Slate-100
    selected: "#e2e8f0", // Slate-200
  },
};

export const theme = createTheme({
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    subtitle1: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: "-0.005em",
    },
    button: {
      fontWeight: 500,
      textTransform: "none",
    },
    caption: {
      color: palette.text.secondary,
    },
  },
  palette,
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#cbd5e1", // Slate-300
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "#94a3b8", // Slate-400
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#4338ca", // Indigo-700
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)", // Tailwind shadow-sm
          border: "1px solid #e2e8f0", // Slate-200
        },
        elevation2: {
           boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.1)", // Tailwind shadow
        }
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "none",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(8px)",
          color: palette.text.primary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          borderLeft: "1px solid #e2e8f0",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        sizeSmall: {
          height: 20,
          fontSize: "0.75rem",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          marginBottom: 2,
          "&.Mui-selected": {
            backgroundColor: "#eff6ff", // Blue-50
            color: "#1d4ed8", // Blue-700
            "&:hover": {
               backgroundColor: "#dbeafe", // Blue-100
            },
            "& .MuiListItemIcon-root": {
                color: "#1d4ed8",
            }
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderBottom: "1px solid #e2e8f0",
          "&:before": {
            display: "none",
          },
          "&.Mui-expanded": {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
        styleOverrides: {
            root: {
                 minHeight: 48,
                 "&.Mui-expanded": {
                    minHeight: 48,
                 }
            },
            content: {
                margin: "12px 0",
                "&.Mui-expanded": {
                    margin: "12px 0",
                }
            }
        }
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
      styleOverrides: {
        root: {
           "& .MuiOutlinedInput-root": {
               backgroundColor: "#fff",
           }
        }
      }
    },
  },
});
