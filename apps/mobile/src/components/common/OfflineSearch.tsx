// Offline Search Component for Story 2B.1 - AC2B.1.2
// Local search functionality for players and matches

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { enhancedOfflineService } from '@protour/shared';
import { debounce } from 'lodash';

interface SearchResult {
  id: string;
  collection: string;
  data: any;
  searchScore: number;
  matchedFields: string[];
  isFromCache: boolean;
}

interface OfflineSearchProps {
  collections?: string[];
  placeholder?: string;
  onResultSelect?: (result: SearchResult) => void;
  maxResults?: number;
  minQueryLength?: number;
  showCollectionBadge?: boolean;
}

const OfflineSearch: React.FC<OfflineSearchProps> = ({
  collections = ['players', 'matches'],
  placeholder = 'Search players, matches...',
  onResultSelect,
  maxResults = 20,
  minQueryLength = 2,
  showCollectionBadge = true,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({
    totalResults: 0,
    searchTime: 0,
    fromCache: true,
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        setSearchStats({ totalResults: 0, searchTime: 0, fromCache: true });
        return;
      }

      setIsSearching(true);
      const startTime = Date.now();

      try {
        const searchResults = await enhancedOfflineService.searchOffline(searchQuery, collections);
        const limitedResults = searchResults.slice(0, maxResults);
        
        setResults(limitedResults as SearchResult[]);
        setSearchStats({
          totalResults: searchResults.length,
          searchTime: Date.now() - startTime,
          fromCache: true,
        });
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
        setSearchStats({ totalResults: 0, searchTime: 0, fromCache: true });
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [collections, maxResults, minQueryLength]
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  const handleResultPress = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  const getCollectionDisplayName = (collection: string): string => {
    switch (collection) {
      case 'players': return 'Player';
      case 'matches': return 'Match';
      case 'tournaments': return 'Tournament';
      default: return collection;
    }
  };

  const getCollectionColor = (collection: string): string => {
    switch (collection) {
      case 'players': return '#007bff';
      case 'matches': return '#28a745';
      case 'tournaments': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    const displayName = getResultDisplayName(item);
    const displaySubtitle = getResultSubtitle(item);
    
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {displayName}
            </Text>
            
            {showCollectionBadge && (
              <View style={[
                styles.collectionBadge,
                { backgroundColor: getCollectionColor(item.collection) }
              ]}>
                <Text style={styles.collectionBadgeText}>
                  {getCollectionDisplayName(item.collection)}
                </Text>
              </View>
            )}
          </View>
          
          {displaySubtitle && (
            <Text style={styles.resultSubtitle} numberOfLines={2}>
              {displaySubtitle}
            </Text>
          )}
          
          {item.matchedFields.length > 0 && (
            <View style={styles.matchedFields}>
              <Text style={styles.matchedFieldsText}>
                Matched: {item.matchedFields.join(', ')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.resultMeta}>
          <Text style={styles.searchScore}>
            {item.searchScore}%
          </Text>
          {item.isFromCache && (
            <View style={styles.cacheIndicator}>
              <Text style={styles.cacheIndicatorText}>📱</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getResultDisplayName = (result: SearchResult): string => {
    const { collection, data } = result;
    
    switch (collection) {
      case 'players':
        return data.name || data.email || `Player ${data.id}`;
      case 'matches':
        return `${data.player1Name || 'TBD'} vs ${data.player2Name || 'TBD'}`;
      case 'tournaments':
        return data.name || `Tournament ${data.id}`;
      default:
        return data.name || data.title || data.id || 'Unknown';
    }
  };

  const getResultSubtitle = (result: SearchResult): string => {
    const { collection, data } = result;
    
    switch (collection) {
      case 'players':
        return [
          data.organization,
          data.ranking && `Ranking: ${data.ranking}`,
          data.email,
        ].filter(Boolean).join(' • ');
      case 'matches':
        return [
          data.court && `Court ${data.court}`,
          data.round && `Round ${data.round}`,
          data.status,
        ].filter(Boolean).join(' • ');
      case 'tournaments':
        return [
          data.sport,
          data.location,
          data.status,
        ].filter(Boolean).join(' • ');
      default:
        return '';
    }
  };

  const renderEmptyState = () => {
    if (query.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Start typing to search...
          </Text>
        </View>
      );
    }
    
    if (query.length < minQueryLength) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Type at least {minQueryLength} characters to search
          </Text>
        </View>
      );
    }
    
    if (results.length === 0 && !isSearching) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No results found for "{query}"
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Try a different search term or check if data is cached
          </Text>
        </View>
      );
    }
    
    return null;
  };

  const renderSearchStats = () => {
    if (results.length === 0 || query.length < minQueryLength) return null;
    
    return (
      <View style={styles.searchStats}>
        <Text style={styles.searchStatsText}>
          {searchStats.totalResults} results in {searchStats.searchTime}ms
          {searchStats.fromCache && ' (offline)'}
        </Text>
        {searchStats.totalResults > maxResults && (
          <Text style={styles.searchStatsSubtext}>
            Showing top {maxResults} results
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        
        {isSearching && (
          <View style={styles.searchIndicator}>
            <ActivityIndicator size="small" color="#007bff" />
          </View>
        )}
      </View>

      {/* Search Stats */}
      {renderSearchStats()}

      {/* Results */}
      <FlatList
        data={results}
        renderItem={renderSearchResult}
        keyExtractor={(item) => `${item.collection}_${item.id}`}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIndicator: {
    marginLeft: 12,
  },
  searchStats: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchStatsText: {
    fontSize: 12,
    color: '#666',
  },
  searchStatsSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  collectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  collectionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  matchedFields: {
    marginTop: 4,
  },
  matchedFieldsText: {
    fontSize: 11,
    color: '#007bff',
    fontStyle: 'italic',
  },
  resultMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  searchScore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 4,
  },
  cacheIndicator: {
    alignItems: 'center',
  },
  cacheIndicatorText: {
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default OfflineSearch;