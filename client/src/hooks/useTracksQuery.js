import { useQuery } from "@tanstack/react-query";

export const useTracksQuery = (searchTerm) => {
  return useQuery({
    queryKey: ["tracks", searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/tracks?search=${searchTerm}`);
      return res.json();
    },
    enabled: !!searchTerm, // only run when there's a search term
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
};
