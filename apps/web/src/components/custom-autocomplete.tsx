// React imports
import { forwardRef } from 'react'
import type { ElementType } from 'react'

// MUI imports
import Paper from '@mui/material/Paper'
import Autocomplete from '@mui/material/Autocomplete'
import Popper from '@mui/material/Popper'
import type { AutocompleteProps } from '@mui/material/Autocomplete'

// Custom Popper that renders in document.body with high z-index
const CustomPopper = (props: any) => {
  return (
    <Popper
      {...props}
      container={document.body}
      style={{ ...props.style, zIndex: 1400 }}
      placement="bottom-start"
    />
  )
}

const CustomAutocomplete = forwardRef(
  <
    T,
    Multiple extends boolean | undefined,
    DisableClearable extends boolean | undefined,
    FreeSolo extends boolean | undefined,
    ChipComponent extends ElementType
  >(
    props: AutocompleteProps<T, Multiple, DisableClearable, FreeSolo, ChipComponent>,
    ref: any
  ) => {
    return (
      // eslint-disable-next-line lines-around-comment
      <Autocomplete
        {...props}
        ref={ref}
        slots={{
          paper: props => <Paper {...props} />,
          popper: CustomPopper,
          ...props.slots,
        }}
      />
    )
  }
) as typeof Autocomplete

export default CustomAutocomplete
