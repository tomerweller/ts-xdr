# frozen_string_literal: true

# xdrgen TypeScript backend — generates a single {namespace}_generated.ts file
# that imports from 'ts-stellar-xdr' and uses the type-value duality pattern.
#
# Install as: lib/xdrgen/generators/typescript.rb in stellar/xdrgen

module Xdrgen
  module Generators
    class Typescript < Xdrgen::Generators::Base
      MAX_INT = (2**31) - 1

      def generate
        path = "#{@namespace}_generated.ts"
        @out = @output.open(path)

        # Collect all definitions (including deeply nested), then topological sort
        all_defs = collect_all_definitions(@top)
        sorted = topological_sort(all_defs)

        render_header
        sorted.each { |defn| render_definition(defn) }
      end

      private

      # =====================================================================
      # Definition collection and topological sort
      # =====================================================================

      def collect_all_definitions(node)
        defs = []
        node.definitions.each do |defn|
          collect_with_nested(defn, defs)
        end
        node.namespaces.each { |ns| defs.concat(collect_all_definitions(ns)) }
        defs
      end

      # Recursively collect nested definitions before the parent
      def collect_with_nested(defn, defs)
        if defn.respond_to?(:nested_definitions)
          defn.nested_definitions.each do |ndefn|
            collect_with_nested(ndefn, defs)
          end
        end
        defs << defn
      end

      def topological_sort(definitions)
        # Build name → definition index (use generated TS names for nested defs)
        by_name = {}
        definitions.each do |d|
          next unless d.respond_to?(:name)
          key = ts_def_key(d)
          by_name[key] = d
        end

        # Also map const names (SCREAMING_SNAKE_CASE) to definitions
        definitions.each do |d|
          if d.is_a?(AST::Definitions::Const)
            by_name[const_name(d)] = d
          end
        end

        sorted  = []
        visited = {}
        @cycle_members = Set.new  # Track definitions involved in cycles

        visit = lambda do |defn|
          key = defn.object_id
          return if visited[key] == :done
          if visited[key] == :visiting
            # Cycle detected — mark this definition
            @cycle_members.add(ts_def_key(defn))
            return
          end
          visited[key] = :visiting

          deps = definition_deps(defn)
          deps.each do |dep_name|
            dep = by_name[dep_name]
            if dep
              visit.call(dep)
              # If the dep is in a cycle, this defn's reference to it may be forward
              if visited[dep.object_id] == :visiting
                @cycle_members.add(dep_name)
              end
            end
          end

          visited[key] = :done
          sorted << defn
        end

        definitions.each { |d| visit.call(d) }
        sorted
      end

      # Returns a stable key for a definition (its generated TS name)
      def ts_def_key(d)
        if d.is_a?(AST::Concerns::NestedDefinition)
          type_name(d)
        elsif d.is_a?(AST::Definitions::Const)
          const_name(d)
        elsif d.respond_to?(:name)
          d.name
        else
          d.object_id.to_s
        end
      end

      # Returns an array of type/const names that this definition depends on
      def definition_deps(defn)
        deps = []
        case defn
        when AST::Definitions::Struct
          defn.members.each { |m| deps.concat(decl_deps(m.declaration)) }
        when AST::Definitions::Union
          # discriminant type
          if defn.discriminant.type.is_a?(AST::Typespecs::Simple)
            deps << defn.discriminant.type.text_value
          end
          defn.normal_arms.each do |arm|
            deps.concat(decl_deps(arm.declaration)) unless arm.void?
          end
          if defn.default_arm.present? && !defn.default_arm.void?
            deps.concat(decl_deps(defn.default_arm.declaration))
          end
        when AST::Definitions::Typedef
          deps.concat(decl_deps(defn.declaration))
        end
        deps
      end

      # Returns type/const name dependencies from a declaration
      def decl_deps(decl)
        deps = []
        case decl
        when AST::Declarations::Void
          # nothing
        when AST::Declarations::Opaque, AST::Declarations::String
          # primitives, but may have named size
          if decl.respond_to?(:size_spec) && decl.size_spec.respond_to?(:named?) && decl.size_spec.named?
            deps << const_name_str(decl.size)
          end
        when AST::Declarations::Optional
          deps.concat(type_deps(decl.type))
        when AST::Declarations::Array
          deps.concat(type_deps(decl.type))
          # Array sizes may reference named constants
          if decl.size_spec.respond_to?(:named?) && decl.size_spec.named?
            deps << const_name_str(decl.size)
          end
        when AST::Declarations::Simple
          deps.concat(type_deps(decl.type))
        end
        deps
      end

      def type_deps(type)
        case type
        when AST::Typespecs::Simple
          [type.text_value]
        when AST::Concerns::NestedDefinition
          [type_name(type)]
        when AST::Definitions::Base
          [type.name]
        else
          []
        end
      end

      def render_definition(defn)
        case defn
        when AST::Definitions::Struct
          render_struct(defn)
        when AST::Definitions::Enum
          render_enum(defn)
        when AST::Definitions::Union
          render_union(defn)
        when AST::Definitions::Typedef
          render_typedef(defn)
        when AST::Definitions::Const
          render_const(defn)
        end
      end

      # =====================================================================
      # Header
      # =====================================================================

      def render_header
        @out.puts "// Automatically generated by xdrgen"
        @out.puts "// DO NOT EDIT or your changes may be overwritten"
        @out.puts ""
        @out.puts "import {"
        @out.puts "  type XdrCodec,"
        @out.puts "  int32,"
        @out.puts "  uint32,"
        @out.puts "  int64,"
        @out.puts "  uint64,"
        @out.puts "  float32,"
        @out.puts "  float64,"
        @out.puts "  bool,"
        @out.puts "  xdrVoid,"
        @out.puts "  fixedOpaque,"
        @out.puts "  varOpaque,"
        @out.puts "  xdrString,"
        @out.puts "  fixedArray,"
        @out.puts "  varArray,"
        @out.puts "  option,"
        @out.puts "  lazy,"
        @out.puts "  xdrStruct,"
        @out.puts "  xdrEnum,"
        @out.puts "  taggedUnion,"
        @out.puts "} from 'ts-stellar-xdr';"
        @out.puts ""
      end

      # =====================================================================
      # Constants
      # =====================================================================

      def render_const(const)
        @out.puts "export const #{const_name(const)} = #{const.value};"
        @out.puts ""
      end

      # =====================================================================
      # Typedefs — type + const (type-value duality)
      # =====================================================================

      def render_typedef(typedef)
        ts = type_name(typedef)
        ts_type = ts_type_ref(typedef.declaration)
        codec = codec_ref(typedef.declaration)

        @out.puts "export type #{ts} = #{ts_type};"
        @out.puts "export const #{ts}: XdrCodec<#{ts}> = #{codec};"
        @out.puts ""
      end

      # =====================================================================
      # Enums — string literal union type + xdrEnum const
      # =====================================================================

      def render_enum(enum)
        ts = type_name(enum)
        members = enum.members

        ts_names = members.map { |m| member_ts_name(m) }

        # Type alias: string literal union
        literals = ts_names.map { |n| "'#{n}'" }.join(" | ")
        @out.puts "export type #{ts} = #{literals};"

        # Const: xdrEnum({...})
        @out.puts "export const #{ts} = xdrEnum({"
        members.each_with_index do |m, i|
          @out.puts "  #{ts_names[i]}: #{m.value},"
        end
        @out.puts "});"
        @out.puts ""
      end

      # =====================================================================
      # Structs — readonly interface + xdrStruct
      # =====================================================================

      def render_struct(struct)
        ts = type_name(struct)

        # Interface
        @out.puts "export interface #{ts} {"
        struct.members.each do |m|
          field = field_name(m)
          ft = ts_type_ref(m.declaration)
          @out.puts "  readonly #{field}: #{ft};"
        end
        @out.puts "}"

        # Codec
        @out.puts "export const #{ts}: XdrCodec<#{ts}> = xdrStruct<#{ts}>(["
        struct.members.each do |m|
          field = field_name(m)
          codec = codec_ref(m.declaration)
          @out.puts "  ['#{field}', #{codec}],"
        end
        @out.puts "]);"
        @out.puts ""
      end

      # =====================================================================
      # Unions — tagged discriminated union type + taggedUnion codec
      # =====================================================================

      def render_union(union)
        ts = type_name(union)
        # discriminant_type returns the definition (could be Typedef wrapping an Enum)
        disc_defn = union.discriminant_type
        resolved_disc = resolve_through_typedefs(disc_defn)
        is_enum = resolved_disc.is_a?(AST::Definitions::Enum)

        # ---- Type alias ----
        @out.puts "export type #{ts} ="

        union.normal_arms.each do |arm|
          arm.cases.each do |kase|
            tag = render_tag(kase, union, is_enum, resolved_disc)
            if arm.void?
              @out.puts "  | { readonly tag: #{tag} }"
            else
              arm_ts = arm_ts_type(arm, ts)
              @out.puts "  | { readonly tag: #{tag}; readonly value: #{arm_ts} }"
            end
          end
        end

        if union.default_arm.present?
          dtag = is_enum ? "string" : "number"
          if union.default_arm.void?
            @out.puts "  | { readonly tag: #{dtag} }"
          else
            arm_ts = ts_type_ref(union.default_arm.declaration)
            @out.puts "  | { readonly tag: #{dtag}; readonly value: #{arm_ts} }"
          end
        end

        @out.puts ";"
        @out.puts ""

        # ---- Codec ----
        switch_codec = if is_enum
          maybe_lazy(type_name(disc_defn))
        else
          base_codec(union.discriminant.type)
        end

        @out.puts "export const #{ts}: XdrCodec<#{ts}> = taggedUnion({"
        @out.puts "  switchOn: #{switch_codec},"
        @out.puts "  arms: ["

        union.normal_arms.each do |arm|
          tags = arm.cases.map { |kase| render_tag(kase, union, is_enum, resolved_disc) }
          tags_str = tags.join(", ")

          if arm.void?
            @out.puts "    { tags: [#{tags_str}] },"
          else
            arm_codec = arm_codec_expr(arm, ts)
            @out.puts "    { tags: [#{tags_str}], codec: #{arm_codec} },"
          end
        end

        @out.puts "  ],"

        if union.default_arm.present?
          if union.default_arm.void?
            @out.puts "  defaultArm: {},"
          else
            dc = codec_ref(union.default_arm.declaration)
            @out.puts "  defaultArm: { codec: #{dc} },"
          end
        end

        @out.puts "}) as XdrCodec<#{ts}>;"
        @out.puts ""
      end

      # =====================================================================
      # Union helpers
      # =====================================================================

      # Renders a tag value for union type alias and codec
      def render_tag(kase, union, is_enum, resolved_disc = nil)
        if is_enum && resolved_disc
          # Find the enum member matching this case
          member = resolved_disc.members.find { |m| m.name == kase.value.text_value }
          if member.nil?
            # Might be referenced through a constant or cross-enum reference
            member = union.namespace.find_enum_value(kase.value.text_value) rescue nil
            member = resolved_disc.members.find { |m| m.name == kase.value.text_value } if member.nil?
          end
          if member
            "'#{member_ts_name(member)}'"
          else
            # Fallback: use the case value name with prefix stripping via name_short
            "'#{to_pascal_case(kase.name_short)}'"
          end
        elsif kase.value.is_a?(AST::Identifier)
          # int-discriminated but case references a named constant
          found = union.namespace.find_enum_value(kase.value.text_value) rescue nil
          if found
            found.value.to_s
          else
            kase.value.text_value
          end
        else
          kase.value.text_value
        end
      end

      # Returns the TS type for a union arm's value
      def arm_ts_type(arm, parent_ts)
        if arm.type.is_a?(AST::Concerns::NestedDefinition)
          type_name(arm.type)
        else
          ts_type_ref(arm.declaration)
        end
      end

      # Returns the codec expression for a union arm
      def arm_codec_expr(arm, parent_ts)
        if arm.type.is_a?(AST::Concerns::NestedDefinition)
          maybe_lazy(type_name(arm.type))
        else
          codec_ref(arm.declaration)
        end
      end

      # =====================================================================
      # Type reference — returns a TS type string for a declaration
      # =====================================================================

      def ts_type_ref(decl)
        case decl
        when AST::Declarations::Void
          "void"
        when AST::Declarations::Opaque
          "Uint8Array"
        when AST::Declarations::String
          "string"
        when AST::Declarations::Optional
          "#{ts_base_type(decl.type)} | undefined"
        when AST::Declarations::Array
          "readonly #{ts_base_type(decl.type)}[]"
        when AST::Declarations::Simple
          ts_base_type(decl.type)
        else
          ts_base_type(decl.type)
        end
      end

      def ts_base_type(type)
        case type
        when AST::Typespecs::Int            then "number"
        when AST::Typespecs::UnsignedInt    then "number"
        when AST::Typespecs::Hyper          then "bigint"
        when AST::Typespecs::UnsignedHyper  then "bigint"
        when AST::Typespecs::Float          then "number"
        when AST::Typespecs::Double         then "number"
        when AST::Typespecs::Bool           then "boolean"
        when AST::Typespecs::Opaque         then "Uint8Array"
        when AST::Typespecs::String         then "string"
        when AST::Typespecs::Simple         then type_name(type)
        when AST::Definitions::Base         then type_name(type)
        when AST::Concerns::NestedDefinition then type_name(type)
        else "unknown"
        end
      end

      # =====================================================================
      # Codec reference — returns a codec expression for a declaration
      # =====================================================================

      def codec_ref(decl)
        case decl
        when AST::Declarations::Void
          "xdrVoid"
        when AST::Declarations::Opaque
          if decl.fixed?
            "fixedOpaque(#{decl.size})"
          else
            size = decl.size || MAX_INT
            "varOpaque(#{size})"
          end
        when AST::Declarations::String
          size = decl.size || MAX_INT
          "xdrString(#{size})"
        when AST::Declarations::Optional
          "option(#{base_codec(decl.type)})"
        when AST::Declarations::Array
          base = base_codec(decl.type)
          is_named, size = decl.size_spec.named?, decl.size
          if decl.fixed?
            size_expr = is_named ? const_name_str(size) : size.to_s
            "fixedArray(#{size_expr}, #{base})"
          else
            size_expr = if is_named
              const_name_str(size)
            elsif size
              size.to_s
            else
              MAX_INT.to_s
            end
            "varArray(#{size_expr}, #{base})"
          end
        when AST::Declarations::Simple
          base_codec(decl.type)
        else
          base_codec(decl.type)
        end
      end

      def base_codec(type)
        case type
        when AST::Typespecs::Int            then "int32"
        when AST::Typespecs::UnsignedInt    then "uint32"
        when AST::Typespecs::Hyper          then "int64"
        when AST::Typespecs::UnsignedHyper  then "uint64"
        when AST::Typespecs::Float          then "float32"
        when AST::Typespecs::Double         then "float64"
        when AST::Typespecs::Bool           then "bool"
        when AST::Typespecs::Opaque
          type.fixed? ? "fixedOpaque(#{type.size})" : "varOpaque(#{type.size})"
        when AST::Typespecs::String
          "xdrString(#{type.size})"
        when AST::Typespecs::Simple         then maybe_lazy(type_name(type))
        when AST::Definitions::Base         then maybe_lazy(type_name(type))
        when AST::Concerns::NestedDefinition then maybe_lazy(type_name(type))
        else raise "Unknown type for codec: #{type.class.name}"
        end
      end

      # =====================================================================
      # Lazy wrapping for circular dependencies
      # =====================================================================

      # Wraps a codec name in lazy(() => X) if X is part of a circular dependency
      def maybe_lazy(name)
        if @cycle_members&.include?(name)
          "lazy(() => #{name})"
        else
          name
        end
      end

      # =====================================================================
      # Name conversion helpers
      # =====================================================================

      # Type/definition name → PascalCase, handling nested definitions
      def type_name(named)
        if named.is_a?(AST::Concerns::NestedDefinition)
          parent = type_name(named.parent_defn)
          "#{parent}#{to_pascal_case(named.name)}"
        else
          to_pascal_case(named.name)
        end
      end

      # Struct field / union member name → camelCase
      def field_name(member)
        to_camel_case(member.name)
      end

      # Constant name → SCREAMING_SNAKE_CASE
      def const_name(const)
        const.name.gsub(/([a-z])([A-Z])/, '\1_\2').upcase
      end

      def const_name_str(name)
        name.gsub(/([a-z])([A-Z])/, '\1_\2').upcase
      end

      # Enum member → PascalCase with prefix stripping
      # Uses xdrgen's built-in `name_short` for prefix stripping
      def member_ts_name(member)
        to_pascal_case(member.name_short)
      end

      # =====================================================================
      # Typedef resolution
      # =====================================================================

      def resolve_through_typedefs(defn)
        return nil if defn.nil?
        cur = defn
        while cur.is_a?(AST::Definitions::Typedef)
          cur = cur.resolved_type
        end
        cur
      end

      # =====================================================================
      # String case conversion
      # =====================================================================

      def to_pascal_case(str)
        # Already PascalCase: starts with uppercase, has at least one lowercase, no underscores
        return str if str.match?(/\A[A-Z][a-zA-Z0-9]*\z/) && str.match?(/[a-z]/) && !str.include?("_")

        str.split("_").map do |word|
          next "" if word.empty?
          if word.match?(/\A[A-Z0-9]+\z/)
            # All uppercase: capitalize first, lowercase rest
            word[0].upcase + word[1..].downcase
          elsif word.match?(/\A[a-z]/)
            word[0].upcase + word[1..]
          else
            word
          end
        end.join
      end

      def to_camel_case(str)
        return str if str.match?(/\A[a-z][a-zA-Z0-9]*\z/) && !str.include?("_")

        pascal = to_pascal_case(str)
        return str if pascal.empty?
        pascal[0].downcase + pascal[1..]
      end
    end
  end
end
