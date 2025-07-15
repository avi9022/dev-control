import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CircleX } from "lucide-react";
import type { FC } from "react";

interface SearchInputProps extends React.ComponentProps<"input"> {
  onClear: () => void
}

export const SearchInput: FC<SearchInputProps> = ({ onClear, ...props }) => {
  return <div className="relative h-[35px]">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Search..." className="pl-9" {...props} />
    <Button type="button" onClick={onClear} className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
      <CircleX />
    </Button>
  </div>
}