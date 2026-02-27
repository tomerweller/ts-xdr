# frozen_string_literal: true

# xdrgen TypeScript backend — generates a single {namespace}_generated.ts file
# that imports from 'ts-stellar-sdk' and uses the type-value duality pattern.
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

        # Generate compat file for legacy API compatibility
        compat_path = "#{@namespace}_compat.ts"
        @compat = @output.open(compat_path)
        render_compat(sorted)
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
        @out.puts "} from '../src/index.js';"
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

        # ---- Type alias (externally-tagged) ----
        @out.puts "export type #{ts} ="

        union.normal_arms.each do |arm|
          arm.cases.each do |kase|
            tag = render_tag(kase, union, is_enum, resolved_disc)
            if arm.void?
              # Int-discriminated void arms use string keys at runtime (reverseMap keyed by String(tag))
              type_tag = is_enum ? tag : "'#{tag}'"
              @out.puts "  | #{type_tag}"
            else
              arm_ts = arm_ts_type(arm, ts)
              # For int-discriminated value arms, keep string key (runtime uses Object.keys → strings)
              prop_key = is_enum ? unquote(tag) : "'#{tag}'"
              @out.puts "  | { readonly #{prop_key}: #{arm_ts} }"
            end
          end
        end

        if union.default_arm.present?
          if union.default_arm.void?
            if is_enum
              @out.puts "  | string"
            else
              @out.puts "  | number"
            end
          else
            arm_ts = ts_type_ref(union.default_arm.declaration)
            if is_enum
              @out.puts "  | { readonly [key: string]: #{arm_ts} }"
            else
              @out.puts "  | { readonly [key: number]: #{arm_ts} }"
            end
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
          "#{ts_base_type(decl.type)} | null"
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

      # Strip surrounding quotes from a string like "'Foo'" → "Foo" or "0" → "0"
      def unquote(s)
        if s.start_with?("'") && s.end_with?("'")
          s[1..-2]
        else
          s
        end
      end

      # =====================================================================
      # Compat generation — legacy API compatibility layer
      # =====================================================================

      def render_compat(sorted)
        render_compat_header
        render_compat_helpers
        sorted.each { |defn| render_compat_definition(defn) }
      end

      def render_compat_header
        @compat.puts "// Automatically generated by xdrgen"
        @compat.puts "// DO NOT EDIT or your changes may be overwritten"
        @compat.puts ""
        @compat.puts "import * as modern from '@stellar/xdr';"
        @compat.puts "import {"
        @compat.puts "  createCompatStruct,"
        @compat.puts "  createCompatEnum,"
        @compat.puts "  createCompatUnion,"
        @compat.puts "  createCompatTypedef,"
        @compat.puts "  identity,"
        @compat.puts "  hyperConverter,"
        @compat.puts "  unsignedHyperConverter,"
        @compat.puts "  optionConverter,"
        @compat.puts "  arrayConverter,"
        @compat.puts "  lazyConverter,"
        @compat.puts "  type Converter,"
        @compat.puts "  Hyper,"
        @compat.puts "  UnsignedHyper,"
        @compat.puts "} from '../xdr-compat/index.js';"
        @compat.puts ""
      end

      def render_compat_helpers
        @compat.puts "const id = identity<any>();"
        @compat.puts "const int64Conv = hyperConverter();"
        @compat.puts "const uint64Conv = unsignedHyperConverter();"
        @compat.puts ""
        @compat.puts "function structConverter(C: any): Converter<any, any> {"
        @compat.puts "  return { toCompat: (m: any) => C._fromModern(m), toModern: (c: any) => c._toModern() };"
        @compat.puts "}"
        @compat.puts "function enumConverter(C: any): Converter<any, any> {"
        @compat.puts "  return { toCompat: (m: any) => C._fromModern(m), toModern: (c: any) => c._toModern() };"
        @compat.puts "}"
        @compat.puts "function unionConverter(C: any): Converter<any, any> {"
        @compat.puts "  return { toCompat: (m: any) => C._fromModern(m), toModern: (c: any) => c._toModern() };"
        @compat.puts "}"
        @compat.puts ""
      end

      def render_compat_definition(defn)
        case defn
        when AST::Definitions::Enum     then render_compat_enum(defn)
        when AST::Definitions::Struct   then render_compat_struct(defn)
        when AST::Definitions::Union    then render_compat_union(defn)
        when AST::Definitions::Typedef  then render_compat_typedef(defn)
        when AST::Definitions::Const    then render_compat_const(defn)
        end
      end

      # --- Compat enum ---
      def render_compat_enum(defn)
        ts = compat_type_name(defn)
        modern_ts = type_name(defn)
        members = defn.members
        compat_names = members.map { |m| compat_member_name(m) }
        modern_names = members.map { |m| member_ts_name(m) }
        values = members.map { |m| m.value }

        # Instance interface
        name_literals = compat_names.map { |n| "'#{n}'" }.join(" | ")
        value_literals = values.join(" | ")
        @compat.puts "export interface #{ts} {"
        @compat.puts "  readonly name: #{name_literals};"
        @compat.puts "  readonly value: #{value_literals};"
        @compat.puts "}"

        # Runtime registration
        @compat.puts "const _#{ts} = createCompatEnum({"
        @compat.puts "  codec: modern.#{modern_ts},"
        @compat.puts "  members: ["
        members.each_with_index do |m, i|
          @compat.puts "    { compat: '#{compat_names[i]}', modern: '#{modern_names[i]}', value: #{m.value} },"
        end
        @compat.puts "  ],"
        @compat.puts "});"

        # Typed export (static interface)
        @compat.puts "export const #{ts} = _#{ts} as unknown as {"
        compat_names.each do |cn|
          @compat.puts "  #{cn}(): #{ts};"
        end
        @compat.puts "};"
        @compat.puts ""
      end

      # --- Compat struct ---
      def render_compat_struct(defn)
        ts = compat_type_name(defn)
        modern_ts = type_name(defn)

        # Instance interface
        @compat.puts "export interface #{ts} {"
        defn.members.each do |m|
          fname = compat_field_name(m.name)
          ftype = compat_type_ref(m.declaration)
          @compat.puts "  #{fname}(value?: #{ftype}): #{ftype};"
        end
        @compat.puts "  toXDR(format?: 'raw'): Buffer;"
        @compat.puts "  toXDR(format: 'hex' | 'base64'): string;"
        @compat.puts "}"

        # Runtime registration
        @compat.puts "const _#{ts} = createCompatStruct({"
        @compat.puts "  codec: modern.#{modern_ts},"
        @compat.puts "  fields: ["
        defn.members.each do |m|
          fname = compat_field_name(m.name)
          modern_fname = field_name(m)
          conv = compat_converter_expr(m.declaration)
          @compat.puts "    { name: '#{fname}', modernName: '#{modern_fname}', convert: #{conv} },"
        end
        @compat.puts "  ],"
        @compat.puts "});"

        # Typed export (static interface)
        ctor_fields = defn.members.map { |m|
          "#{compat_field_name(m.name)}: #{compat_type_ref(m.declaration)}"
        }.join("; ")
        @compat.puts "export const #{ts} = _#{ts} as unknown as {"
        @compat.puts "  new(attributes: { #{ctor_fields} }): #{ts};"
        render_compat_xdr_statics(ts)
        @compat.puts "};"
        @compat.puts ""
      end

      # --- Compat union ---
      def render_compat_union(defn)
        ts = compat_type_name(defn)
        modern_ts = type_name(defn)
        disc_defn = defn.discriminant_type
        resolved_disc = resolve_through_typedefs(disc_defn)
        is_enum = resolved_disc.is_a?(AST::Definitions::Enum)

        # Instance interface
        @compat.puts "export interface #{ts} {"
        if is_enum
          @compat.puts "  switch(): #{compat_type_name(disc_defn)};"
        else
          @compat.puts "  switch(): number;"
        end

        value_types = []
        has_void = false

        defn.normal_arms.each do |arm|
          if arm.void?
            has_void = true
          else
            aname = compat_arm_name(arm)
            atype = compat_arm_type_ref(arm)
            @compat.puts "  #{aname}(value?: #{atype}): #{atype};"
            value_types << atype
          end
        end

        if defn.default_arm.present?
          if defn.default_arm.void?
            has_void = true
          else
            aname = compat_arm_name(defn.default_arm)
            atype = compat_type_ref(defn.default_arm.declaration)
            @compat.puts "  #{aname}(value?: #{atype}): #{atype};"
            value_types << atype
          end
        end

        # value() method
        vtypes = value_types.dup
        vtypes << "void" if has_void
        vtypes = ["void"] if vtypes.empty?
        @compat.puts "  value(): #{vtypes.join(' | ')};"
        @compat.puts "  toXDR(format?: 'raw'): Buffer;"
        @compat.puts "  toXDR(format: 'hex' | 'base64'): string;"
        @compat.puts "}"

        # Runtime registration
        if is_enum
          render_compat_enum_union(defn, ts, modern_ts, disc_defn, resolved_disc)
        else
          render_compat_int_union(defn, ts, modern_ts)
        end

        # Typed export (static interface)
        @compat.puts "export const #{ts} = _#{ts} as unknown as {"
        defn.normal_arms.each do |arm|
          arm.cases.each do |kase|
            if is_enum
              sv = compat_switch_value(kase, resolved_disc)
            else
              sv = kase.value.text_value
            end
            if arm.void?
              @compat.puts "  #{sv}(): #{ts};"
            else
              atype = compat_arm_type_ref(arm)
              @compat.puts "  #{sv}(value: #{atype}): #{ts};"
            end
          end
        end
        if defn.default_arm.present?
          # Default arm factories would need remaining enum values; skip for now
        end
        render_compat_xdr_statics(ts)
        @compat.puts "};"
        @compat.puts ""
      end

      # Enum-discriminated union runtime registration
      def render_compat_enum_union(defn, ts, modern_ts, disc_defn, resolved_disc)
        disc_ts = compat_type_name(disc_defn)
        @compat.puts "const _#{ts} = createCompatUnion({"
        @compat.puts "  codec: modern.#{modern_ts},"
        @compat.puts "  switchEnum: _#{disc_ts},"
        @compat.puts "  arms: ["

        defn.normal_arms.each do |arm|
          svs = arm.cases.map { |kase| "'#{compat_switch_value(kase, resolved_disc)}'" }.join(", ")
          modern_tag = render_tag(arm.cases.first, defn, true, resolved_disc)

          if arm.void?
            @compat.puts "    { switchValues: [#{svs}], modern: #{modern_tag} },"
          else
            aname = compat_arm_name(arm)
            conv = compat_converter_expr(arm.declaration)
            @compat.puts "    { switchValues: [#{svs}], modern: #{modern_tag}, arm: '#{aname}', convert: #{conv} },"
          end
        end

        if defn.default_arm.present?
          # For default arms, we'd need all remaining switch values.
          # For now, emit a comment.
          @compat.puts "    // default arm not yet supported"
        end

        @compat.puts "  ],"
        @compat.puts "});"
      end

      # Int-discriminated union runtime registration
      def render_compat_int_union(defn, ts, modern_ts)
        @compat.puts "const _#{ts} = createCompatUnion({"
        @compat.puts "  codec: modern.#{modern_ts},"
        @compat.puts "  switchEnum: null,"
        @compat.puts "  arms: ["

        defn.normal_arms.each do |arm|
          svs = arm.cases.map { |kase|
            tag = render_tag(kase, defn, false, nil)
            tag
          }.join(", ")
          modern_tag = render_tag(arm.cases.first, defn, false, nil)

          if arm.void?
            @compat.puts "    { switchValues: [#{svs}], modern: #{modern_tag} },"
          else
            aname = compat_arm_name(arm)
            conv = compat_converter_expr(arm.declaration)
            @compat.puts "    { switchValues: [#{svs}], modern: #{modern_tag}, arm: '#{aname}', convert: #{conv} },"
          end
        end

        if defn.default_arm.present?
          @compat.puts "    // default arm not yet supported"
        end

        @compat.puts "  ],"
        @compat.puts "});"
      end

      # --- Compat typedef ---
      def render_compat_typedef(defn)
        ts = compat_type_name(defn)
        modern_ts = type_name(defn)
        decl = defn.declaration
        ct = compat_type_ref(decl)

        case decl
        when AST::Declarations::Simple
          case decl.type
          when AST::Typespecs::Hyper
            # Int64 = Hyper
            @compat.puts "export const #{ts} = Hyper;"
            @compat.puts "export type #{ts} = Hyper;"
          when AST::Typespecs::UnsignedHyper
            # Uint64 = UnsignedHyper
            @compat.puts "export const #{ts} = UnsignedHyper;"
            @compat.puts "export type #{ts} = UnsignedHyper;"
          when AST::Typespecs::Int, AST::Typespecs::UnsignedInt, AST::Typespecs::Float, AST::Typespecs::Double, AST::Typespecs::Bool
            # Uint32 = number — needs createCompatTypedef for static methods
            @compat.puts "export type #{ts} = #{ct};"
            @compat.puts "export const #{ts} = createCompatTypedef({ codec: modern.#{modern_ts}, convert: id });"
          when AST::Typespecs::Simple
            # Named type reference — check if it resolves to a struct/union/enum
            resolved = resolve_through_typedefs(decl.type.respond_to?(:resolved_type) ? (decl.type.resolved_type rescue nil) : nil)
            if resolved.is_a?(AST::Definitions::Enum) || resolved.is_a?(AST::Definitions::Struct) || resolved.is_a?(AST::Definitions::Union)
              # Type alias only (e.g., AccountId = PublicKey)
              @compat.puts "export type #{ts} = #{ct};"
            else
              # Primitive typedef through named type
              @compat.puts "export type #{ts} = #{ct};"
            end
          end
        when AST::Declarations::Opaque
          @compat.puts "export type #{ts} = Buffer;"
          @compat.puts "export const #{ts} = createCompatTypedef({ codec: modern.#{modern_ts}, convert: id });"
        when AST::Declarations::String
          @compat.puts "export type #{ts} = string | Buffer;"
          @compat.puts "export const #{ts} = createCompatTypedef({ codec: modern.#{modern_ts}, convert: id });"
        when AST::Declarations::Array
          inner_conv = compat_base_converter(decl.type)
          @compat.puts "export type #{ts} = #{ct};"
          @compat.puts "export const #{ts} = createCompatTypedef({ codec: modern.#{modern_ts}, convert: arrayConverter(#{inner_conv}) });"
        when AST::Declarations::Optional
          inner_conv = compat_base_converter(decl.type)
          @compat.puts "export type #{ts} = #{ct};"
          @compat.puts "export const #{ts} = createCompatTypedef({ codec: modern.#{modern_ts}, convert: optionConverter(#{inner_conv}) });"
        end
        @compat.puts ""
      end

      # --- Compat const ---
      def render_compat_const(defn)
        # Constants are just re-exported from modern
        @compat.puts "export const #{const_name(defn)} = #{defn.value};"
        @compat.puts ""
      end

      # --- Static XDR methods for struct/union typed exports ---
      def render_compat_xdr_statics(ts)
        @compat.puts "  read(io: Buffer): #{ts};"
        @compat.puts "  write(value: #{ts}, io: Buffer): void;"
        @compat.puts "  isValid(value: #{ts}): boolean;"
        @compat.puts "  toXDR(value: #{ts}): Buffer;"
        @compat.puts "  fromXDR(input: Buffer, format?: 'raw'): #{ts};"
        @compat.puts "  fromXDR(input: string, format: 'hex' | 'base64'): #{ts};"
        @compat.puts "  validateXDR(input: Buffer, format?: 'raw'): boolean;"
        @compat.puts "  validateXDR(input: string, format: 'hex' | 'base64'): boolean;"
      end

      # =====================================================================
      # Compat name helpers
      # =====================================================================

      # Convert a name to legacy PascalCase using the same algorithm as the JS xdrgen generator.
      # Uses ActiveSupport underscore+classify: SCVal → sc_val → ScVal
      def legacy_classify(name)
        underscored = name.underscore.downcase
        is_plural = underscored.pluralize == underscored
        base = name.underscore.classify
        is_plural ? base.pluralize : base
      end

      # Legacy PascalCase type name (for compat interfaces + exports)
      def compat_type_name(named)
        if named.is_a?(AST::Concerns::NestedDefinition)
          parent = compat_type_name(named.parent_defn)
          "#{parent}#{legacy_classify(named.name)}"
        else
          legacy_classify(named.name)
        end
      end

      # Legacy camelCase field/arm name
      def compat_field_name(name)
        legacy_classify(name).sub(/\A./) { |c| c.downcase }
      end

      # Enum member → camelCase of FULL original name (e.g., ASSET_TYPE_NATIVE → assetTypeNative)
      def compat_member_name(member)
        compat_field_name(member.name)
      end

      # Union arm accessor name from arm declaration
      def compat_arm_name(arm)
        return nil if arm.void?
        compat_field_name(arm.declaration.name)
      end

      # Switch value for compat (e.g., 'assetTypeNative')
      def compat_switch_value(kase, resolved_disc)
        member = resolved_disc.members.find { |m| m.name == kase.value.text_value }
        if member
          compat_member_name(member)
        else
          compat_field_name(kase.value.text_value)
        end
      end

      # =====================================================================
      # Compat type references — returns TS type for compat interfaces
      # =====================================================================

      def compat_type_ref(decl)
        case decl
        when AST::Declarations::Void      then "void"
        when AST::Declarations::Opaque    then "Buffer"
        when AST::Declarations::String    then "string | Buffer"
        when AST::Declarations::Optional  then "null | #{compat_base_type(decl.type)}"
        when AST::Declarations::Array     then "#{compat_base_type(decl.type)}[]"
        when AST::Declarations::Simple    then compat_base_type(decl.type)
        else "any"
        end
      end

      def compat_base_type(type)
        case type
        when AST::Typespecs::Int            then "number"
        when AST::Typespecs::UnsignedInt    then "number"
        when AST::Typespecs::Hyper          then "Hyper"
        when AST::Typespecs::UnsignedHyper  then "UnsignedHyper"
        when AST::Typespecs::Float          then "number"
        when AST::Typespecs::Double         then "number"
        when AST::Typespecs::Bool           then "boolean"
        when AST::Typespecs::Opaque         then "Buffer"
        when AST::Typespecs::String         then "string | Buffer"
        when AST::Typespecs::Simple         then compat_type_name(type)
        when AST::Definitions::Base         then compat_type_name(type)
        when AST::Concerns::NestedDefinition then compat_type_name(type)
        else "any"
        end
      end

      # Returns compat type for a union arm's value
      def compat_arm_type_ref(arm)
        if arm.type.is_a?(AST::Concerns::NestedDefinition)
          compat_type_name(arm.type)
        else
          compat_type_ref(arm.declaration)
        end
      end

      # =====================================================================
      # Compat converter expressions — returns converter code strings
      # =====================================================================

      def compat_converter_expr(decl)
        case decl
        when AST::Declarations::Void      then "id"
        when AST::Declarations::Opaque    then "id"
        when AST::Declarations::String    then "id"
        when AST::Declarations::Optional
          inner = compat_base_converter(decl.type)
          "optionConverter(#{inner})"
        when AST::Declarations::Array
          inner = compat_base_converter(decl.type)
          "arrayConverter(#{inner})"
        when AST::Declarations::Simple
          compat_base_converter(decl.type)
        else
          "id"
        end
      end

      def compat_base_converter(type)
        case type
        when AST::Typespecs::Int, AST::Typespecs::UnsignedInt, AST::Typespecs::Float, AST::Typespecs::Double, AST::Typespecs::Bool
          "id"
        when AST::Typespecs::Hyper          then "int64Conv"
        when AST::Typespecs::UnsignedHyper  then "uint64Conv"
        when AST::Typespecs::Opaque         then "id"
        when AST::Typespecs::String         then "id"
        when AST::Typespecs::Simple         then resolve_named_converter(type)
        when AST::Definitions::Base         then resolve_named_converter(type)
        when AST::Concerns::NestedDefinition then resolve_named_converter(type)
        else "id"
        end
      end

      # Resolve a named type through typedefs to determine the right converter.
      # Walks the typedef chain manually so Array/Optional wrappers are not lost.
      def resolve_named_converter(type)
        defn = type.respond_to?(:resolved_type) ? (type.resolved_type rescue nil) : nil
        return "id" unless defn

        # Walk the typedef chain, handling array/optional wrapper declarations
        cur = defn
        while cur.is_a?(AST::Definitions::Typedef)
          d = cur.declaration
          case d
          when AST::Declarations::Array
            inner = compat_base_converter(d.type)
            return "arrayConverter(#{inner})"
          when AST::Declarations::Optional
            inner = compat_base_converter(d.type)
            return "optionConverter(#{inner})"
          when AST::Declarations::Opaque, AST::Declarations::String
            return "id"
          when AST::Declarations::Simple
            case d.type
            when AST::Typespecs::Hyper          then return "int64Conv"
            when AST::Typespecs::UnsignedHyper  then return "uint64Conv"
            when AST::Typespecs::Int, AST::Typespecs::UnsignedInt, AST::Typespecs::Float,
                 AST::Typespecs::Double, AST::Typespecs::Bool
              return "id"
            when AST::Typespecs::Simple
              next_defn = d.type.respond_to?(:resolved_type) ? (d.type.resolved_type rescue nil) : nil
              return "id" unless next_defn
              cur = next_defn
            else
              return "id"
            end
          else
            return "id"
          end
        end

        # cur is now a non-typedef definition
        case cur
        when AST::Definitions::Enum
          modern_name = type_name(cur)
          legacy_name = compat_type_name(cur)
          compat_maybe_lazy("enumConverter(_#{legacy_name})", modern_name)
        when AST::Definitions::Struct
          modern_name = type_name(cur)
          legacy_name = compat_type_name(cur)
          compat_maybe_lazy("structConverter(_#{legacy_name})", modern_name)
        when AST::Definitions::Union
          modern_name = type_name(cur)
          legacy_name = compat_type_name(cur)
          compat_maybe_lazy("unionConverter(_#{legacy_name})", modern_name)
        else
          "id"
        end
      end

      # Lazy wrapping for compat converters
      # Checks cycle membership using modern_name (since @cycle_members uses modern names)
      def compat_maybe_lazy(expr, modern_name)
        if @cycle_members&.include?(modern_name)
          "lazyConverter(() => #{expr})"
        else
          expr
        end
      end
    end
  end
end
